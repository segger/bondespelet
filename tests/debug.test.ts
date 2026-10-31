import assert from 'node:assert/strict';
import test from 'node:test';
import { actingPlayerIndex, applyAction, crofts } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import type { Action } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { playing, roll } from './game-helpers.ts';

test('debug mode defaults off and only the host can toggle it with a boolean', () => {
  const game = playing();
  assert.equal(game.debug, undefined);
  assert.throws(() => applyAction(game, 'p1', { type: 'set-debug', enabled: true }), /Only the host/);
  assert.throws(() => applyAction(game, 'outsider', { type: 'set-debug', enabled: true }), /Join/);
  for (const enabled of ['true', 1, null, undefined]) {
    assert.throws(() => applyAction(game, 'p0', { type: 'set-debug', enabled } as unknown as Action), /whether debug mode/);
  }
  const enabled = applyAction(game, 'p0', { type: 'set-debug', enabled: true });
  assert.equal(enabled.debug, true);
  assert.equal(game.debug, undefined);
  assert.deepEqual(enabled.players, game.players);
  assert.equal(enabled.currentPlayer, game.currentPlayer);
  assert.throws(() => applyAction(enabled, 'p1', { type: 'set-debug', enabled: false }), /Only the host/);
  assert.equal(applyAction(enabled, 'p0', { type: 'set-debug', enabled: false }).debug, false);
});

test('the host can make opening rolls and tied rerolls for every player', () => {
  let game = applyAction(playing(4, false), 'p0', { type: 'set-debug', enabled: true });
  for (const [i, face] of [6, 6, 5, 2].entries()) {
    assert.equal(actingPlayerIndex(game, 'p0'), i);
    game = roll(game, face, 'p0');
    assert.equal(game.players[i].roll, face);
  }
  assert.equal(game.turnOrder, undefined);
  assert.equal(actingPlayerIndex(game, 'p0'), 0);
  game = roll(game, 2, 'p0');
  assert.equal(actingPlayerIndex(game, 'p0'), 1);
  game = roll(game, 4, 'p0');
  assert.deepEqual(game.turnOrder, ['p1', 'p0', 'p2', 'p3']);
  assert.deepEqual(game.players.map((p) => p.rolls), [[6, 2], [6, 4], [5], [2]]);
});

test('the host can select crofts, plant, return crops and confirm for the current player', () => {
  let game = playing(3, false);
  for (const face of [2, 6, 4]) game = roll(game, face);
  game = applyAction(game, 'p0', { type: 'set-debug', enabled: true });
  for (const [i, id] of game.turnOrder!.entries()) {
    assert.equal(game.players[actingPlayerIndex(game, 'p0')].id, id);
    game = applyAction(game, 'p0', { type: 'select-croft', croftId: crofts[i].id });
    assert.equal(game.players.find((p) => p.id === id)!.croft, crofts[i].id);
    assert.throws(() => roll(game, 1, 'p0'), /before playing turns/);
    game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
    game = applyAction(game, 'p0', { type: 'return-crop', fieldIndex: 0 });
    assert.throws(() => applyAction(game, 'p0', { type: 'confirm-planting' }), /No planting/);
    game = applyAction(game, 'p0', { type: 'plant', crop: 'barley' });
    game = applyAction(game, 'p0', { type: 'confirm-planting' });
    assert.deepEqual(game.players.find((p) => p.id === id)!.crops, ['barley']);
  }
  assert.equal(game.plantingOrder, undefined);
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  game = roll(game, 3, 'p0');
  assert.deepEqual(game.players.map((p) => p.position), [0, 3, 0]);
});

test('host turn control respects normal rules and ends immediately when debug is disabled', () => {
  let game = applyAction(playing(3), 'p0', { type: 'set-debug', enabled: true });
  assert.throws(() => applyAction(game, 'p0', { type: 'end-turn' }), /Roll the die/);
  game = roll(game, 1, 'p0');
  game = applyAction(game, 'p0', { type: 'end-turn' });
  assert.throws(() => roll(game, 1, 'p2'), /not your turn/);
  game = roll(game, 3, 'p0');
  assert.deepEqual(game.players.map((p) => p.position), [1, 3, 0]);
  assert.throws(() => roll(game, 1, 'p0'), /already rolled/);
  const disabled = applyAction(game, 'p0', { type: 'set-debug', enabled: false });
  assert.throws(() => applyAction(disabled, 'p0', { type: 'end-turn' }), /not your turn/);
  assert.throws(() => applyAction(disabled, 'p0', { type: 'end-turn', playerId: 'p1' } as Action), /not your turn/);
  const ended = applyAction(disabled, 'p1', { type: 'end-turn' });
  assert.equal(ended.players[ended.currentPlayer].id, 'p2');
});

test('the host can play an entire year and perform next-year planting for everyone', () => {
  let game = applyAction(playing(3), 'p0', { type: 'set-debug', enabled: true });
  for (const player of game.players) player.position = 108;
  for (let i = 0; i < 3; i++) {
    game = roll(game, 1, 'p0');
    game = applyAction(game, 'p0', { type: 'end-turn' });
  }
  assert.equal(game.year, 2);
  for (const id of game.turnOrder!) {
    game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
    game = applyAction(game, 'p0', { type: 'confirm-planting' });
    assert.deepEqual(game.players.find((p) => p.id === id)!.crops, ['wheat']);
  }
  assert.equal(game.plantingOrder, undefined);
  assert.equal(game.debug, true);
});

test('debug only redirects turn actions, and control follows the host when hosting transfers', () => {
  let game = applyAction(playing(3), 'p0', { type: 'set-debug', enabled: true });
  game = roll(game, 1, 'p0');
  game = applyAction(game, 'p0', { type: 'end-turn' });
  game = applyAction(game, 'p0', { type: 'set-color', color: 'white' });
  assert.equal(game.players[0].color, 'white');
  assert.equal(game.players[1].color, 'red');
  game = applyAction(game, 'p0', { type: 'leave' });
  assert.deepEqual(game.players.map((p) => p.id), ['p1', 'p2']);
  assert.equal(actingPlayerIndex(game, 'outsider'), -1);
  assert.throws(() => roll(game, 1, 'p0'), /Join/);
  game = roll(game, 1, 'p1');
  game = applyAction(game, 'p1', { type: 'end-turn' });
  assert.equal(game.players[game.currentPlayer].id, 'p2');
  game = roll(game, 2, 'p1');
  assert.equal(game.players[1].position, 2);
  assert.throws(() => applyAction(game, 'p2', { type: 'set-debug', enabled: false }), /Only the host/);
});
