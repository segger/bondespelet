import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardSpaceCount } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import type { Action } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { chooseCrofts, playing, roll } from './game-helpers.ts';

test('each turn starts with one server roll that moves only the current player', () => {
  for (let face = 1; face <= 6; face++) {
    const game = playing();
    assert.throws(() => applyAction(game, 'p0', { type: 'end-turn' }), /Roll the die/);
    assert.throws(() => roll(game, face, 'p1'), /not your turn/);
    const moved = roll(game, face, 'p0');
    assert.equal(moved.turnRoll, face);
    assert.deepEqual(moved.players.map((p) => p.position), [face, 0]);
    assert.deepEqual(game.players.map((p) => p.position), [0, 0]);
    assert.deepEqual(moved.players.map((p) => p.rolls), game.players.map((p) => p.rolls));
    assert.deepEqual(moved.fields, game.fields);
    assert.equal(moved.currentPlayer, game.currentPlayer);
    assert.throws(() => roll(moved, face, 'p0'), /already rolled this turn/);
    assert.throws(() => applyAction(moved, 'p1', { type: 'end-turn' }), /not your turn/);
  }
});

test('movement follows numbered spaces across all four sides and stops at the end of the year', () => {
  for (const [start, face, expected] of [[27, 1, 28], [54, 2, 56], [81, 3, 84], [107, 1, 108], [108, 1, 109], [106, 6, 109], [108, 6, 109]]) {
    const game = playing();
    game.players[0].position = start;
    assert.equal(roll(game, face, 'p0').players[0].position, expected);
  }
  assert.equal(boardSpaceCount, 108);
});

test('ending turns follows opening roll order and preserves marker positions for the next turn', () => {
  let game = playing(4, false);
  for (const face of [2, 6, 1, 4]) game = roll(game, face);
  game = chooseCrofts(game);
  for (const id of ['p1', 'p3', 'p0', 'p2']) {
    assert.equal(game.players[game.currentPlayer].id, id);
    game = roll(game, 3, id);
    const positions = game.players.map((p) => p.position);
    game = applyAction(game, id, { type: 'end-turn' });
    assert.equal(game.turnRoll, undefined);
    assert.deepEqual(game.players.map((p) => p.position), positions);
    assert.equal(game.status, 'playing');
  }
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  assert.deepEqual(game.players.map((p) => p.position), [3, 3, 3, 3]);
  assert.equal(roll(game, 2, 'p1').players[1].position, 5);
});

test('turn rolls ignore supplied results and positions, and support previously saved players', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const game = playing();
  delete game.players[0].position;
  const moved = applyAction(game, 'p0', { type: 'roll', roll: 99, position: 99 } as Action);
  assert.equal(moved.turnRoll, 4);
  assert.equal(moved.players[0].position, 4);
});

test('unknown actions are rejected without changing state', () => {
  const game = roll(playing(), 1, 'p0');
  const snapshot = structuredClone(game);
  assert.throws(() => applyAction(game, 'p0', { type: 'unknown' } as unknown as Action), /Unknown action/);
  assert.deepEqual(game, snapshot);
  assert.throws(() => applyAction(game, 'p2', { type: 'join', name: 'Cia' }), /already started/);
  assert.throws(() => applyAction(game, 'p0', { type: 'create' } as Action), /Unknown/);
});
