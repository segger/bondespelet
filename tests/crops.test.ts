import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, cropPlantingCost, crops, cropsPerStack, playerFieldCount } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { plantFields } from '../supabase/functions/_shared/games/bondespelet/planting.ts';
import type { PlantingAction } from '../supabase/functions/_shared/games/bondespelet/planting.ts';
import type { Action, Game } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { chooseCroft, chooseCrofts, endTurn, playing, roll } from './game-helpers.ts';

function plant(game: Game, playerId: string, action: PlantingAction) {
  const next = structuredClone(game);
  plantFields(next, next.players.findIndex((p) => p.id === playerId), action);
  return next;
}

function yearShift() {
  let game = playing();
  for (const player of game.players) player.position = 108;
  game = endTurn(game, 'p0');
  return endTurn(game, 'p1');
}

for (const [buildingType, cost] of [['croft', 1_000], ['farm', 3_000], ['mansion', 10_000]] as const) {
  test(`year-shift planting costs ${cost} kr per crop for a ${buildingType} and refunds returns`, () => {
    let game = yearShift();
    game.players[0].buildingType = buildingType;
    game.players[0].money = cost * 2;
    const original = structuredClone(game);
    game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
    assert.equal(game.players[0].money, cost);
    assert.equal(original.players[0].money, cost * 2);
    game = applyAction(game, 'p0', { type: 'plant', crop: 'barley' });
    assert.equal(game.players[0].money, 0);
    const beforeRejected = structuredClone(game);
    assert.throws(() => applyAction(game, 'p0', { type: 'plant', crop: 'oats' }), /kr to plant a crop/);
    assert.deepEqual(game, beforeRejected);
    game = applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 0 });
    assert.equal(game.players[0].money, cost);
    assert.deepEqual(game.players[0].crops, ['barley']);
    game = applyAction(game, 'p0', { type: 'plant', crop: 'oats' });
    game = applyAction(game, 'p0', { type: 'confirm-planting' });
    assert.equal(game.players[0].money, 0, 'confirmation must not charge twice');
    assert.equal(game.players[1].money, original.players[1].money);
    assert.equal(game.currentPlayer, 1);
  });

  test(`initial planting is free for a ${buildingType}, including when returning crops`, () => {
    let game = playing(2, true, false);
    game.players[0].buildingType = buildingType;
    game.players[0].money = 0;
    game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
    game = applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 0 });
    assert.equal(game.players[0].money, 0);
    game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
    game = applyAction(game, 'p0', { type: 'confirm-planting' });
    assert.equal(game.players[0].money, 0);
  });
}

test('year-shift prices apply to later years and saved crofts without a building type', () => {
  let game = yearShift();
  game.year = 3;
  delete game.players[0].buildingType;
  delete game.players[0].money;
  assert.equal(cropPlantingCost(game.players[0], game.year), 1_000);
  game = applyAction(game, 'p0', { type: 'plant', crop: 'potatoes' });
  assert.equal(game.players[0].money, 9_000);
  assert.equal(cropPlantingCost(game.players[0]), 0);
});

test('debug planting charges and refunds the controlled player', () => {
  let game = applyAction(yearShift(), 'p0', { type: 'set-debug', enabled: true });
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'confirm-planting' });
  game.players[1].buildingType = 'farm';
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  assert.deepEqual(game.players.map((p) => p.money), [9_000, 7_000]);
  game = applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 0 });
  assert.deepEqual(game.players.map((p) => p.money), [9_000, 10_000]);
});

test('players who cannot afford any year-shift crops can continue with empty fields', () => {
  let game = yearShift();
  game.players[0].money = 999;
  game.players[1].money = 0;
  assert.throws(() => applyAction(game, 'p0', { type: 'plant', crop: 'wheat' }), /kr to plant a crop/);
  game = applyAction(game, 'p0', { type: 'confirm-planting' });
  assert.equal(game.currentPlayer, 1);
  game = applyAction(game, 'p1', { type: 'confirm-planting' });
  assert.equal(game.plantingOrder, undefined);
  assert.deepEqual(game.players.map((p) => p.money), [999, 0]);
  assert.ok(game.players.every((p) => p.crops?.length === 0));
  assert.equal(roll(game, 1, 'p0').players[0].position, 1);
});

test('empty confirmation is rejected when a crop is affordable and during initial planting', () => {
  const game = yearShift();
  game.players[0].money = 1_000;
  assert.throws(() => applyAction(game, 'p0', { type: 'confirm-planting' }), /No planting/);
  const initial = playing(2, true, false);
  initial.players[0].money = 0;
  assert.throws(() => applyAction(initial, 'p0', { type: 'confirm-planting' }), /No planting/);
});

for (const count of [2, 3, 4]) {
  test(`${count} players complete initial planting in turn order before anyone moves`, () => {
    let game = playing(count, false);
    for (let i = 0; i < count; i++) game = roll(game, i + 1);
    game = chooseCrofts(game, false);
    const order = [...game.turnOrder!];
    assert.deepEqual(game.plantingOrder, order);
    for (const [i, id] of order.entries()) {
      game = chooseCroft(game);
      assert.equal(game.players[game.currentPlayer].id, id);
      const snapshot = structuredClone(game);
      assert.throws(() => roll(game, 3, id), /before playing turns/);
      assert.throws(() => applyAction(game, id, { type: 'confirm-planting' }), /No planting/);
      assert.throws(() => applyAction(game, id, { type: 'end-turn' }), /before playing turns/);
      assert.deepEqual(game, snapshot);
      game = applyAction(game, id, { type: 'plant', crop: 'wheat' });
      assert.throws(() => roll(game, 3, id), /before playing turns/);
      game = applyAction(game, id, { type: 'return-crop', fieldIndex: 0 });
      assert.throws(() => applyAction(game, id, { type: 'confirm-planting' }), /No planting/);
      game = applyAction(game, id, { type: 'plant', crop: 'barley' });
      game = applyAction(game, id, { type: 'confirm-planting' });
      assert.deepEqual(game.players.find((p) => p.id === id)!.crops, ['barley']);
      assert.deepEqual(game.plantingOrder, i === count - 1 ? undefined : order.slice(i + 1));
      assert.ok(game.players.every((p) => p.position === 0));
      if (i < count - 1) assert.throws(() => roll(game, 3, order[0]), /before playing turns/);
    }
    assert.equal(game.players[game.currentPlayer].id, order[0]);
    for (const id of order) game = endTurn(game, id);
    assert.equal(roll(game, 2, order[0]).turnRoll, 2);
    assert.equal(game.plantingOrder, undefined);
  });
}

test('six shared crop stacks each supply twelve crops to players fields', () => {
  assert.equal(crops.length, 6);
  assert.equal(new Set(crops.map((crop) => crop.id)).size, 6);
  assert.equal(cropsPerStack, 12);
  for (const crop of crops) {
    let game = playing(4, true, false);
    for (const player of game.players) {
      game = chooseCroft(game);
      game = applyAction(game, player.id, { type: 'plant', crop: crop.id });
      game = applyAction(game, player.id, { type: 'plant', crop: crop.id });
      game = applyAction(game, player.id, { type: 'plant', crop: crop.id });
      game = applyAction(game, player.id, { type: 'confirm-planting' });
    }
    assert.throws(() => plant(game, 'p0', { type: 'plant', crop: crop.id }), /stack is empty/);
    assert.equal(game.players.flatMap((p) => p.crops ?? []).filter((id) => id === crop.id).length, 12);
  }
});

for (const [buildingType, capacity] of [['croft', 3], ['farm', 3], ['mansion', 5]] as const) {
  test(`${buildingType} has ${capacity} fields and rejects planting beyond its capacity`, () => {
    let game = playing(2, true, false);
    game.players[0].buildingType = buildingType;
    assert.equal(playerFieldCount(game.players[0]), capacity);
    for (let i = 0; i < capacity; i++) game = applyAction(game, 'p0', { type: 'plant', crop: crops[i].id });
    assert.throws(() => applyAction(game, 'p0', { type: 'plant', crop: 'wheat' }), /fields are already planted/);
    assert.equal(game.players[0].crops?.length, capacity);
    assert.equal(game.players[1].crops, undefined);
  });
}

test('players without a building have no fields and saved crofts default to three', () => {
  assert.equal(playerFieldCount(), 0);
  assert.equal(playerFieldCount(createGame('p0', 'Astrid', 2).players[0]), 0);
  let game = playing(2, true, false);
  delete game.players[0].buildingType;
  assert.equal(playerFieldCount(game.players[0]), 3);
  for (let i = 0; i < 3; i++) game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  assert.throws(() => applyAction(game, 'p0', { type: 'plant', crop: 'barley' }), /fields are already planted/);
});

test('reusable planting supports later planting without changing movement, points or turns', () => {
  const game = roll(playing(), 3, 'p0');
  delete game.players[0].crops;
  const planted = plant(game, 'p0', { type: 'plant', crop: 'wheat' });
  assert.deepEqual(planted.players[0].crops, ['wheat']);
  assert.equal(game.players[0].crops, undefined);
  assert.deepEqual(planted.players[1], game.players[1]);
  assert.equal(planted.currentPlayer, game.currentPlayer);
  assert.equal(planted.turnRoll, 3);
  assert.equal(planted.players[0].position, game.players[0].position);
  assert.equal(planted.players[0].money, game.players[0].money);
  assert.equal(planted.players[0].score, 0);
  assert.deepEqual(planted.fields, game.fields);
});

test('planting requires a member, their turn, a valid crop and completed setup', () => {
  const plant: Action = { type: 'plant', crop: 'wheat' };
  assert.throws(() => applyAction(createGame('p0', 'Astrid', 2), 'p0', plant), /not in progress/);
  let game = playing(2, false);
  assert.throws(() => applyAction(game, 'p0', plant), /Every player must roll/);
  game = roll(roll(game, 6, 'p0'), 5, 'p1');
  assert.throws(() => applyAction(game, 'p0', plant), /choose a croft/);
  game = chooseCrofts(game, false);
  assert.throws(() => applyAction(game, 'outsider', plant), /Join/);
  assert.throws(() => applyAction(game, 'p1', plant), /not your turn/);
  assert.throws(() => applyAction(game, 'p0', { type: 'plant', crop: 'unknown' } as unknown as Action), /valid crop/);
  assert.throws(() => applyAction({ ...game, status: 'finished' }, 'p0', plant), /not in progress/);
});

test('crops return to the shared stacks when their player leaves', () => {
  let game = playing(3, true, false);
  for (let i = 0; i < 3; i++) game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'leave' });
  game = chooseCroft(game);
  game = applyAction(game, 'p1', { type: 'plant', crop: 'wheat' });
  assert.deepEqual(game.players.find((p) => p.id === 'p1')?.crops, ['wheat']);
});

test('clicking an unconfirmed field returns only that crop and frees its field and stock', () => {
  let game = playing(4, true, false);
  for (const player of game.players.slice(1)) player.crops = ['wheat', 'wheat', 'wheat'];
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'plant', crop: 'barley' });
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  const snapshot = structuredClone(game);
  const returned = applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 1 });
  assert.deepEqual(returned.players[0].crops, ['wheat', 'wheat']);
  assert.equal(returned.players[0].pendingCrops, 2);
  assert.deepEqual(game, snapshot);
  assert.equal(returned.currentPlayer, game.currentPlayer);
  assert.equal(returned.turnRoll, game.turnRoll);
  assert.equal(returned.players[0].score, game.players[0].score);
  assert.equal(returned.players[0].money, game.players[0].money);
  game = applyAction(returned, 'p0', { type: 'plant', crop: 'wheat' });
  assert.throws(() => applyAction(game, 'p0', { type: 'plant', crop: 'wheat' }), /stack is empty/);
  game = applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 0 });
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  assert.equal(game.players.flatMap((p) => p.crops ?? []).filter((crop) => crop === 'wheat').length, 12);
});

test('reusable planting locks confirmed crops while later additions remain returnable', () => {
  let game = plant(playing(2, true, false), 'p0', { type: 'plant', crop: 'wheat' });
  game = plant(game, 'p0', { type: 'confirm-planting' });
  assert.equal(game.players[0].pendingCrops, undefined);
  assert.throws(() => plant(game, 'p0', { type: 'return-crop', fieldIndex: 0 }), /unconfirmed crop/);
  assert.throws(() => plant(game, 'p0', { type: 'confirm-planting' }), /No planting/);
  game = plant(game, 'p0', { type: 'plant', crop: 'barley' });
  assert.throws(() => plant(game, 'p0', { type: 'return-crop', fieldIndex: 0 }), /unconfirmed crop/);
  game = plant(game, 'p0', { type: 'return-crop', fieldIndex: 1 });
  assert.deepEqual(game.players[0].crops, ['wheat']);
  assert.equal(game.players[0].pendingCrops, undefined);
});

test('returning all pending crops restores all fields and treats older saved crops as confirmed', () => {
  let game = applyAction(playing(2, true, false), 'p0', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 0 });
  assert.deepEqual(game.players[0].crops, []);
  assert.equal(game.players[0].pendingCrops, undefined);
  assert.throws(() => applyAction(game, 'p0', { type: 'confirm-planting' }), /No planting/);
  game.players[0].crops = ['oats'];
  assert.throws(() => applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 0 }), /unconfirmed crop/);
});

test('initial planting cannot repeat during normal turns even with empty fields', () => {
  let game = playing();
  delete game.players[0].crops;
  for (const action of [
    { type: 'plant', crop: 'wheat' }, { type: 'return-crop', fieldIndex: 0 }, { type: 'confirm-planting' },
  ] as Action[]) {
    assert.throws(() => applyAction(game, 'p0', action), /Planting is only allowed during preparation/);
  }
  game = endTurn(game, 'p0');
  game = endTurn(game, 'p1');
  assert.equal(roll(game, 2, 'p0').turnRoll, 2);
  assert.equal(game.plantingOrder, undefined);
});

test('leaving during initial planting skips only the departed player and returns to the first roller', () => {
  let game = playing(4, true, false);
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'confirm-planting' });
  game = applyAction(game, 'p2', { type: 'leave' });
  assert.deepEqual(game.plantingOrder, ['p1', 'p3']);
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  game = chooseCroft(game);
  game = applyAction(game, 'p1', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p1', { type: 'confirm-planting' });
  game = applyAction(game, 'p3', { type: 'leave' });
  assert.equal(game.plantingOrder, undefined);
  assert.equal(game.players[game.currentPlayer].id, 'p0');
  assert.equal(roll(game, 2, 'p0').turnRoll, 2);
});

test('returning and confirming crops reject invalid fields, outsiders, other turns and incomplete setup', () => {
  const game = applyAction(playing(2, true, false), 'p0', { type: 'plant', crop: 'wheat' });
  for (const fieldIndex of [-1, 1, 0.5, NaN, '0', null]) {
    assert.throws(() => applyAction(game, 'p0', { type: 'return-crop', fieldIndex } as Action), /unconfirmed crop/);
  }
  for (const action of [{ type: 'return-crop', fieldIndex: 0 }, { type: 'confirm-planting' }] as Action[]) {
    assert.throws(() => applyAction(game, 'outsider', action), /Join/);
    assert.throws(() => applyAction(game, 'p1', action), /not your turn/);
    assert.throws(() => applyAction({ ...game, status: 'finished' }, 'p0', action), /not in progress/);
    let setup = playing(2, false);
    assert.throws(() => applyAction(setup, 'p0', action), /Every player must roll/);
    setup = roll(roll(setup, 6, 'p0'), 5, 'p1');
    assert.throws(() => applyAction(setup, 'p0', action), /choose a croft/);
  }
});
