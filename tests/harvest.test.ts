import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cropsPerStack, startingMoney } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { playing, roll } from './game-helpers.ts';

test('harvesting returns every planted crop and pays per crop for the building', () => {
  for (const [buildingType, count, income] of [
    [undefined, 1, 10_000], ['croft', 3, 30_000], ['farm', 2, 60_000], ['mansion', 5, 500_000],
  ] as const) {
    const game = playing();
    game.players[0].position = 54;
    game.players[0].buildingType = buildingType;
    game.players[0].crops = Array.from({ length: count }, (_, i) => i % 2 ? 'barley' : 'wheat');
    const moved = roll(game, 1, 'p0');
    const snapshot = structuredClone(moved);
    const harvested = applyAction(moved, 'p0', { type: 'harvest' });
    assert.equal(harvested.players[0].money, startingMoney + income);
    assert.deepEqual(harvested.players[0].crops, []);
    assert.deepEqual(harvested.players[1], moved.players[1]);
    assert.equal(harvested.currentPlayer, moved.currentPlayer);
    assert.equal(harvested.turnRoll, moved.turnRoll);
    assert.equal(harvested.players[0].position, 55);
    assert.equal(cropsPerStack - harvested.players.flatMap((p) => p.crops ?? []).filter((crop) => crop === 'barley').length, cropsPerStack);
    assert.match(harvested.lastMove, /harvested all their crops/);
    assert.deepEqual(moved, snapshot);
    assert.throws(() => applyAction(harvested, 'p0', { type: 'harvest' }), /no crops/);
    assert.equal(applyAction(harvested, 'p0', { type: 'end-turn' }).currentPlayer, 1);
  }
});

test('harvesting is optional and only allowed after moving onto spaces 55 through 81 inclusive', () => {
  for (const position of [54, 55, 68, 81, 82]) {
    const game = playing();
    game.players[0].position = position - 1;
    const moved = roll(game, 1, 'p0');
    if (position >= 55 && position <= 81) {
      assert.deepEqual(applyAction(moved, 'p0', { type: 'harvest' }).players[0].crops, []);
    } else {
      assert.throws(() => applyAction(moved, 'p0', { type: 'harvest' }), /spaces 55–81/);
    }
    const skipped = applyAction(moved, 'p0', { type: 'end-turn' });
    assert.deepEqual(skipped.players[0].crops, moved.players[0].crops);
    assert.equal(skipped.players[0].money, moved.players[0].money);
  }
});

test('harvesting requires the current player, completed preparation, a roll and crops', () => {
  const game = playing();
  game.players[0].position = 55;
  assert.throws(() => applyAction(game, 'p0', { type: 'harvest' }), /Roll the die/);
  const moved = roll(game, 1, 'p0');
  assert.throws(() => applyAction(moved, 'p1', { type: 'harvest' }), /not your turn/);
  assert.throws(() => applyAction(moved, 'outsider', { type: 'harvest' }), /Join/);
  for (const crops of [[], undefined]) {
    moved.players[0].crops = crops;
    assert.throws(() => applyAction(moved, 'p0', { type: 'harvest' }), /no crops/);
  }
  assert.throws(() => applyAction(playing(2, false), 'p0', { type: 'harvest' }), /Every player must roll/);
  assert.throws(() => applyAction(playing(2, true, false), 'p0', { type: 'harvest' }), /before playing turns/);
  const ended = applyAction(game, 'p1', { type: 'leave' });
  assert.throws(() => applyAction(ended, 'p0', { type: 'harvest' }), /not in progress/);
});

test('moving to 82 or above returns remaining crops without payment', () => {
  for (const [start, face] of [[80, 1], [81, 1], [80, 6], [82, 1], [108, 1]]) {
    const game = playing();
    game.players[0].position = start;
    game.players[0].crops = ['wheat', 'barley', 'wheat'];
    const snapshot = structuredClone(game);
    const moved = roll(game, face, 'p0');
    const expired = moved.players[0].position! >= 82;
    assert.deepEqual(moved.players[0].crops, expired ? [] : game.players[0].crops);
    assert.equal(moved.players[0].money, game.players[0].money);
    assert.deepEqual(moved.players[1], game.players[1]);
    assert.equal(moved.currentPlayer, game.currentPlayer);
    assert.equal(moved.turnRoll, face);
    assert.equal(moved.lastMove.includes('without payment'), expired);
    assert.deepEqual(game, snapshot);
    if (expired) {
      assert.throws(() => applyAction(moved, 'p0', { type: 'plant', crop: 'wheat' }), /only allowed during preparation/);
    }
  }
});

test('harvested fields stay empty until the year ends and can then be planted again', () => {
  let game = playing();
  game.players[0].position = 54;
  game = applyAction(roll(game, 1, 'p0'), 'p0', { type: 'harvest' });
  for (const action of [
    { type: 'plant', crop: 'wheat' }, { type: 'return-crop', fieldIndex: 0 }, { type: 'confirm-planting' },
  ] as const) {
    assert.throws(() => applyAction(game, 'p0', action), /only allowed during preparation/);
  }
  game = applyAction(game, 'p0', { type: 'end-turn' });
  for (const id of ['p1', 'p0']) {
    game.players[game.currentPlayer].position = 108;
    game = applyAction(roll(game, 1, id), id, { type: 'end-turn' });
  }
  assert.equal(game.year, 2);
  for (const id of game.turnOrder!) {
    game = applyAction(game, id, { type: 'plant', crop: 'wheat' });
    game = applyAction(game, id, { type: 'confirm-planting' });
  }
  assert.deepEqual(game.players[0].crops, ['wheat']);
  assert.equal(game.players[0].money, startingMoney + 10_000 - 1_000);
});
