import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cropPlantingCost, playerFieldCount } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import type { Game } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { chooseCrofts, playing, roll } from './game-helpers.ts';

function move(game: Game, face: number) {
  const id = game.players[game.currentPlayer].id;
  return applyAction(roll(game, face, id), id, { type: 'end-turn' });
}

function finishYear() {
  let game = playing(3);
  game.players[0].position = 100;
  game.players[1].position = 108;
  game.players[2].position = 107;
  for (const face of [1, 1, 2, 6, 2]) game = move(game, face);
  return game;
}

test('finished players wait after 108 while unfinished players continue in the existing order', () => {
  let game = playing(3);
  game.players[0].position = 106;
  const before = structuredClone(game);
  game = roll(game, 6, 'p0');
  assert.equal(game.players[0].position, 109);
  assert.deepEqual(game.finishOrder, ['p0']);
  assert.equal(before.players[0].position, 106);
  assert.equal(before.finishOrder, undefined);
  assert.throws(() => roll(game, 1, 'p0'), /already rolled/);
  game = applyAction(game, 'p0', { type: 'end-turn' });
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  game = move(game, 1);
  game = move(game, 1);
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  assert.equal(game.players[0].position, 109);
  assert.deepEqual(game.turnOrder, ['p0', 'p1', 'p2']);
  assert.equal(game.plantingOrder, undefined);
  assert.equal(game.year, 1);
  assert.throws(() => roll(game, 1, 'p0'), /not your turn/);
});

test('landing on 108 does not finish the year even when everyone reaches it', () => {
  let game = playing();
  for (const player of game.players) player.position = 107;
  game = move(game, 1);
  game = move(game, 1);
  assert.ok(game.players.every((p) => p.position === 108));
  assert.equal(game.year, 1);
  assert.equal(game.finishOrder, undefined);
  assert.equal(game.plantingOrder, undefined);
  game = move(game, 1);
  assert.deepEqual(game.finishOrder, ['p0']);
  assert.equal(game.players[0].position, 109);
  assert.equal(game.year, 1);
  game = move(game, 1);
  assert.equal(game.year, 2);
  assert.deepEqual(game.plantingOrder, ['p0', 'p1']);
});

test('the last finishing turn starts planting in finish order and preserves player resources', () => {
  const original = playing(3);
  const game = finishYear();
  assert.equal(game.year, 2);
  assert.deepEqual(game.turnOrder, ['p1', 'p2', 'p0']);
  assert.deepEqual(game.plantingOrder, game.turnOrder);
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  assert.equal(game.finishOrder, undefined);
  assert.equal(game.turnRoll, undefined);
  assert.equal(game.status, 'playing');
  assert.deepEqual(game.fields, original.fields);
  for (const [i, player] of game.players.entries()) {
    assert.deepEqual(player, { ...original.players[i], position: 0, crops: [] });
  }
});

test('year-shift building changes sell the old building before buying the new one', () => {
  let game = finishYear();
  const originalCroft = game.players[1].croft;
  game.players[1].money = 160_000;
  game = applyAction(game, 'p1', { type: 'change-building', buildingId: 11 });
  assert.equal(game.players[1].money, 10_000);
  assert.equal(game.players[1].croft, 11);
  assert.equal(game.players[1].buildingType, 'farm');
  assert.equal(playerFieldCount(game.players[1]), 3);
  assert.equal(cropPlantingCost(game.players[1], game.year), 3_000);
  game.players[1].money = 550_000;
  game = applyAction(game, 'p1', { type: 'change-building', buildingId: 6 });
  assert.equal(game.players[1].money, 0);
  assert.equal(game.players[1].buildingType, 'mansion');
  assert.equal(playerFieldCount(game.players[1]), 5);
  assert.equal(cropPlantingCost(game.players[1], game.year), 10_000);
  game = applyAction(game, 'p1', { type: 'change-building', buildingId: originalCroft! });
  assert.equal(game.players[1].money, 700_000);
  assert.equal(game.players[1].buildingType, 'croft');
  assert.equal(game.players[1].croft, originalCroft);
  assert.equal(cropPlantingCost(game.players[1], game.year), 1_000);
});

test('building changes require an available building, enough money and the year-shift turn before planting', () => {
  let game = finishYear();
  const change = { type: 'change-building', buildingId: 11 } as const;
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, 'p1', change), /need 200.*kr/);
  assert.deepEqual(game, before);
  assert.throws(() => applyAction(game, 'p2', change), /not your turn/);
  assert.throws(() => applyAction(game, 'p1', { type: 'change-building', buildingId: game.players[2].croft! }), /already taken/);
  assert.throws(() => applyAction(game, 'p1', { type: 'change-building', buildingId: 10 }), /valid building/);
  assert.throws(() => applyAction(game, 'p1', { type: 'change-building', buildingId: game.players[1].croft! }), /already own/);
  game.players[1].money = 150_000;
  game = applyAction(game, 'p1', change);
  game.players[1].money = 3_000;
  game = applyAction(game, 'p1', { type: 'plant', crop: 'wheat' });
  assert.throws(() => applyAction(game, 'p1', { type: 'change-building', buildingId: 0 }), /before planting/);
  assert.throws(() => applyAction(playing(), 'p0', change), /year shift/);
});

test('a player can finish preparation after spending their balance on a building', () => {
  let game = finishYear();
  const soldCroft = game.players[1].croft!;
  game.players[1].money = 150_000;
  game = applyAction(game, 'p1', { type: 'change-building', buildingId: 11 });
  game = applyAction(game, 'p1', { type: 'confirm-planting' });
  assert.equal(game.players[1].money, 0);
  assert.equal(game.players[game.currentPlayer].id, 'p2');
  game = applyAction(game, 'p2', { type: 'change-building', buildingId: soldCroft });
  assert.equal(game.players[2].croft, soldCroft);
});

test('buying the castle with the current building sale ends the game with one winner', () => {
  let game = finishYear();
  const buyCastle = { type: 'change-building', buildingId: 3 } as const;
  game.players[1].money = 2_449_999;
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, 'p1', buyCastle), /need 2.*kr/);
  assert.deepEqual(game, before);
  assert.throws(() => applyAction(game, 'p2', buyCastle), /not your turn/);
  game.players[1].money = 2_450_000;
  const won = applyAction(game, 'p1', buyCastle);
  assert.equal(won.players[1].money, 0);
  assert.equal(won.players[1].croft, 3);
  assert.equal(won.players[1].buildingType, 'castle');
  assert.equal(won.status, 'finished');
  assert.deepEqual(won.winner, { id: 'p1', name: 'Farmer 1' });
  assert.match(won.lastMove, /Farmer 1 wins!/);
  assert.equal(game.status, 'playing');
  assert.throws(() => applyAction(won, 'p1', buyCastle), /year shift/);
  assert.throws(() => applyAction(won, 'p1', { type: 'plant', crop: 'wheat' }), /not in progress/);
  assert.throws(() => roll(won, 1, 'p1'), /not in progress/);
});

test('every player must plant and confirm in the new order before next year movement', () => {
  let game = finishYear();
  for (const id of game.turnOrder!) {
    assert.equal(game.players[game.currentPlayer].id, id);
    const other = game.players.find((p) => p.id !== id)!;
    assert.throws(() => applyAction(game, other.id, { type: 'plant', crop: 'wheat' }), /not your turn/);
    assert.throws(() => applyAction(game, id, { type: 'select-croft', croftId: 1 }), /already chosen/);
    assert.throws(() => applyAction(game, id, { type: 'confirm-planting' }), /No planting/);
    assert.throws(() => roll(game, 1, id), /confirm planting/);
    assert.throws(() => applyAction(game, id, { type: 'end-turn' }), /confirm planting/);
    game = applyAction(game, id, { type: 'plant', crop: 'barley' });
    game = applyAction(game, id, { type: 'return-crop', fieldIndex: 0 });
    assert.throws(() => applyAction(game, id, { type: 'confirm-planting' }), /No planting/);
    game = applyAction(game, id, { type: 'plant', crop: 'wheat' });
    assert.equal(game.players[game.currentPlayer].id, id);
    game = applyAction(game, id, { type: 'confirm-planting' });
  }
  assert.equal(game.plantingOrder, undefined);
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  game = move(game, 3);
  assert.equal(game.players[1].position, 3);
  assert.equal(game.players[game.currentPlayer].id, 'p2');
  assert.throws(() => applyAction(game, 'p2', { type: 'plant', crop: 'wheat' }), /only allowed during preparation/);
});

test('full fields return crops to the stacks at every year change', () => {
  let game = playing(4);
  for (const player of game.players) {
    player.crops = ['wheat', 'wheat', 'wheat'];
    player.position = 108;
  }
  for (let i = 0; i < 4; i++) game = move(game, 1);
  assert.equal(game.year, 2);
  for (const id of game.turnOrder!) {
    for (let field = 0; field < 3; field++) game = applyAction(game, id, { type: 'plant', crop: 'wheat' });
    game = applyAction(game, id, { type: 'confirm-planting' });
  }
  assert.equal(game.players.flatMap((p) => p.crops!).length, 12);
  for (const player of game.players) player.position = 108;
  for (let i = 0; i < 4; i++) game = move(game, 1);
  assert.equal(game.year, 3);
  assert.ok(game.players.every((p) => p.crops?.length === 0));
});

test('finish order is recorded afresh each year', () => {
  let game = chooseCrofts(finishYear());
  game.players[1].position = 106;
  game.players[2].position = 108;
  game.players[0].position = 107;
  for (const face of [1, 1, 2, 2]) game = move(game, face);
  assert.equal(game.year, 3);
  assert.deepEqual(game.turnOrder, ['p2', 'p0', 'p1']);
  assert.deepEqual(game.plantingOrder, game.turnOrder);
});

test('saved games without a year counter advance to year two', () => {
  let game = playing();
  delete game.year;
  for (const player of game.players) player.position = 108;
  game = move(game, 1);
  game = move(game, 1);
  assert.equal(game.year, 2);
  assert.deepEqual(game.plantingOrder, ['p0', 'p1']);
});

test('older saved initial planting continues using the shared planting flow', () => {
  const game = playing(3, true, false);
  game.initialPlanting = game.plantingOrder;
  delete game.plantingOrder;
  assert.throws(() => roll(game, 1, 'p0'), /before playing turns/);
  let planted = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  planted = applyAction(planted, 'p0', { type: 'confirm-planting' });
  assert.equal(planted.initialPlanting, undefined);
  assert.deepEqual(planted.plantingOrder, ['p1', 'p2']);
  assert.equal(planted.players[planted.currentPlayer].id, 'p1');
  assert.deepEqual(game.initialPlanting, ['p0', 'p1', 'p2']);
});

test('leaving removes finish records and skips finished players when choosing the next turn', () => {
  let game = playing(4);
  game.players[0].position = 108;
  game = move(game, 1);
  assert.deepEqual(game.finishOrder, ['p0']);
  const finisherLeft = applyAction(game, 'p0', { type: 'leave' });
  assert.deepEqual(finisherLeft.finishOrder, []);
  assert.equal(finisherLeft.players[finisherLeft.currentPlayer].id, 'p1');
  game = move(game, 1);
  game = move(game, 1);
  assert.equal(game.players[game.currentPlayer].id, 'p3');
  game = applyAction(game, 'p3', { type: 'leave' });
  assert.equal(game.players[game.currentPlayer].id, 'p1');
});

test('another player leaving preserves a finishing roll until its player ends the turn', () => {
  let game = playing(3);
  game.players[0].position = 108;
  game = roll(game, 1, 'p0');
  game = applyAction(game, 'p2', { type: 'leave' });
  assert.equal(game.turnRoll, 1);
  assert.equal(game.players[game.currentPlayer].id, 'p0');
  game = applyAction(game, 'p0', { type: 'end-turn' });
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  assert.equal(game.year, 1);
});

test('the last unfinished player leaving starts planting for the remaining finishers', () => {
  let game = playing(3);
  game.players[0].position = 108;
  game.players[1].position = 108;
  game = move(game, 1);
  game = move(game, 1);
  game = applyAction(game, 'p2', { type: 'leave' });
  assert.equal(game.year, 2);
  assert.deepEqual(game.turnOrder, ['p0', 'p1']);
  assert.deepEqual(game.plantingOrder, game.turnOrder);
  assert.equal(game.players[game.currentPlayer].id, 'p0');
});

test('leaving during yearly planting preserves its order and starts turns after the final confirmation', () => {
  let game = finishYear();
  game = applyAction(game, 'p1', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p1', { type: 'confirm-planting' });
  game = applyAction(game, 'p2', { type: 'leave' });
  assert.deepEqual(game.plantingOrder, ['p0']);
  assert.equal(game.players[game.currentPlayer].id, 'p0');
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'confirm-planting' });
  assert.equal(game.plantingOrder, undefined);
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  assert.equal(roll(game, 2, 'p1').players.find((p) => p.id === 'p1')!.position, 2);
});
