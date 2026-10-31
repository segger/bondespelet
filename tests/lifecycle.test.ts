import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { chooseCrofts, endTurn, playing, roll } from './game-helpers.ts';

test('leaving resets the roll only when the current player leaves', () => {
  const game = roll(playing(4), 4, 'p0');
  const otherLeft = applyAction(game, 'p2', { type: 'leave' });
  assert.equal(otherLeft.turnRoll, 4);
  assert.throws(() => roll(otherLeft, 2, 'p0'), /already rolled/);
  const currentLeft = applyAction(game, 'p0', { type: 'leave' });
  assert.equal(currentLeft.turnRoll, undefined);
  assert.equal(currentLeft.players[currentLeft.currentPlayer].id, 'p1');
  assert.equal(roll(currentLeft, 2, 'p1').players[0].position, 2);
});

test('leaving during opening rolls preserves the next turn and allows turns after the last pending roller leaves', () => {
  let game = roll(playing(4, false), 6);
  game = applyAction(game, 'p0', { type: 'leave' });
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  game = roll(game, 5);
  game = roll(game, 4);
  game = applyAction(game, 'p3', { type: 'leave' });
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  assert.equal(endTurn(chooseCrofts(game), 'p1').players[0].position, 1);
});

test('leaving after rolls follows the saved turn order and removes departed players', () => {
  let game = playing(4, false);
  for (const face of [2, 6, 1, 4]) game = roll(game, face);
  game = chooseCrofts(game);
  for (const [id, expected] of [['p1', 'p3'], ['p0', 'p1'], ['p3', 'p1']]) {
    const left = applyAction(game, id, { type: 'leave' });
    assert.equal(left.players[left.currentPlayer].id, expected);
    assert.deepEqual(left.turnOrder, game.turnOrder!.filter((playerId) => playerId !== id));
    const ended = endTurn(left, expected);
    assert.equal(ended.players[ended.currentPlayer].id,
      left.turnOrder![(left.turnOrder!.indexOf(expected) + 1) % left.turnOrder!.length]);
  }
});

test('lobby validates names, seat limits, and host permissions', () => {
  assert.throws(() => createGame('p0', ' ', 2), /name/);
  assert.throws(() => createGame('p0', 'Astrid', 5), /2–4/);
  assert.throws(() => createGame('p0', 'Astrid', '2' as unknown as number), /2–4/);
  const lobby = createGame('p0', 'Astrid', 2);
  assert.throws(() => applyAction(lobby, 'p0', { type: 'start' }), /two players/);
  const joined = applyAction(lobby, 'p1', { type: 'join', name: 'Bo' });
  assert.equal(lobby.players.length, 1, 'the reducer must not mutate previous state');
  assert.equal(applyAction(joined, 'p1', { type: 'join', name: 'Bo' }).players.length, 2);
  assert.throws(() => applyAction(joined, 'p2', { type: 'join', name: 'Cia' }), /full/);
  assert.throws(() => applyAction(joined, 'p1', { type: 'start' }), /host/);
  assert.throws(() => applyAction(joined, 'outsider', { type: 'start' }), /Join/);
});

test('only the host can end a waiting game, including when waiting alone', () => {
  const alone = createGame('p0', 'Astrid', 4);
  assert.equal(applyAction(alone, 'p0', { type: 'end' }).status, 'finished');
  const lobby = applyAction(alone, 'p1', { type: 'join', name: 'Bo' });
  assert.throws(() => applyAction(lobby, 'p1', { type: 'end' }), /host/);
  assert.throws(() => applyAction(lobby, 'outsider', { type: 'end' }), /Join/);
  const ended = applyAction(lobby, 'p0', { type: 'end' });
  assert.equal(ended.status, 'finished');
  assert.deepEqual(ended.players, lobby.players);
  assert.equal(lobby.status, 'waiting');
  assert.throws(() => applyAction(ended, 'p0', { type: 'start' }), /already started/);
  assert.throws(() => applyAction(ended, 'p2', { type: 'join', name: 'Cia' }), /already started/);
  assert.throws(() => applyAction(ended, 'p0', { type: 'end-turn' }), /not in progress/);
  assert.throws(() => applyAction(ended, 'p0', { type: 'end' }), /waiting/);
  assert.throws(() => applyAction(playing(), 'p0', { type: 'end' }), /waiting/);
});

test('leaving the lobby transfers hosting and frees a seat without changing the previous state', () => {
  const lobby = applyAction(createGame('p0', 'Astrid', 2), 'p1', { type: 'join', name: 'Bo' });
  assert.throws(() => applyAction(lobby, 'outsider', { type: 'leave' }), /Join/);
  const left = applyAction(lobby, 'p0', { type: 'leave' });
  assert.equal(left.status, 'waiting');
  assert.equal(left.players[0].id, 'p1');
  assert.equal(lobby.players.length, 2);
  const joined = applyAction(left, 'p2', { type: 'join', name: 'Cia' });
  assert.equal(applyAction(joined, 'p1', { type: 'start' }).status, 'playing');
  assert.throws(() => applyAction(left, 'p0', { type: 'start' }), /Join/);
  const empty = applyAction(left, 'p1', { type: 'leave' });
  assert.equal(empty.status, 'finished');
  assert.equal(empty.currentPlayer, 0);
  assert.equal(empty.players.length, 0);
});

test('leaving during play releases fields and keeps the correct player turn', () => {
  const game = endTurn(playing(4), 'p0');
  game.fields[0].owner = 'p0';
  game.players[0].score = game.fields[0].value;
  for (const [departingId, expectedTurn] of [['p0', 'p1'], ['p1', 'p2'], ['p3', 'p1']]) {
    const left = applyAction(game, departingId, { type: 'leave' });
    assert.equal(left.status, 'playing');
    assert.equal(left.players[left.currentPlayer].id, expectedTurn);
    assert.ok(left.players.every((p) => p.id !== departingId));
    assert.ok(left.fields.every((f) => f.owner !== departingId));
    const unclaimed = left.fields.filter((f) => f.owner === null).reduce((total, f) => total + f.value, 0);
    assert.equal(left.players.reduce((total, p) => total + p.score, 0) + unclaimed, 24);
    assert.equal(endTurn(left, expectedTurn).turnRoll, undefined);
  }
  assert.equal(game.fields[0].owner, 'p0');
  assert.equal(game.players[0].score, 2);
  const lastTurn = endTurn(endTurn(playing(3), 'p0'), 'p1');
  const wrapped = applyAction(lastTurn, 'p2', { type: 'leave' });
  assert.equal(wrapped.players[wrapped.currentPlayer].id, 'p0');
});

test('an active game ends when a player leaves only one player remaining', () => {
  const left = applyAction(playing(), 'p0', { type: 'leave' });
  assert.equal(left.status, 'finished');
  assert.equal(left.players[0].id, 'p1');
  assert.equal(left.currentPlayer, 0);
  assert.throws(() => applyAction(left, 'p1', { type: 'end-turn' }), /not in progress/);
  assert.equal(applyAction(left, 'p1', { type: 'leave' }).players.length, 0);
});
