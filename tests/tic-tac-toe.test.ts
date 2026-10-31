import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame } from '../supabase/functions/_shared/games/tic-tac-toe/game.ts';

function playing() {
  return applyAction(applyAction(createGame('p0', 'Astrid', 2), 'p1', { type: 'join', name: 'Bo' }), 'p0', { type: 'start' });
}

function play(cells: number[]) {
  return cells.reduce((game, cell, i) => applyAction(game, `p${i % 2}`, { type: 'mark', cell }), playing());
}

test('tic-tac-toe validates names, capacity, joining, and host permissions', () => {
  assert.throws(() => createGame('p0', ' ', 2), /name/);
  assert.throws(() => createGame('p0', 'a'.repeat(25), 2), /name/);
  for (const capacity of [0, 1, 3, 4, '2']) assert.throws(() => createGame('p0', 'Astrid', capacity as number), /two players/);
  const waiting = createGame('p0', ' Astrid ', 2);
  assert.equal(waiting.players[0].name, 'Astrid');
  assert.throws(() => applyAction(waiting, 'p0', { type: 'start' }), /two players/);
  assert.throws(() => applyAction(waiting, 'p0', { type: 'mark', cell: 0 }), /not in progress/);
  assert.throws(() => applyAction(waiting, 'p1', { type: 'join', name: ' ' }), /name/);
  const joined = applyAction(waiting, 'p1', { type: 'join', name: 'Bo' });
  assert.equal(waiting.players.length, 1);
  assert.deepEqual(applyAction(joined, 'p1', { type: 'join', name: 'Bo' }), joined);
  assert.throws(() => applyAction(joined, 'p2', { type: 'join', name: 'Cia' }), /full/);
  assert.throws(() => applyAction(joined, 'p1', { type: 'start' }), /host/);
  assert.throws(() => applyAction(joined, 'p1', { type: 'end' }), /host/);
  assert.throws(() => applyAction(joined, 'outsider', { type: 'start' }), /Join/);
  const started = applyAction(joined, 'p0', { type: 'start' });
  assert.throws(() => applyAction(started, 'p2', { type: 'join', name: 'Cia' }), /already started/);
  assert.throws(() => applyAction(started, 'p0', { type: 'end' }), /already started/);
  assert.throws(() => applyAction(started, 'p0', { type: 'start' }), /already started/);
  const ended = applyAction(waiting, 'p0', { type: 'end' });
  assert.equal(ended.status, 'finished');
  assert.throws(() => applyAction(ended, 'p0', { type: 'start' }), /ended/);
  assert.throws(() => applyAction(ended, 'p1', { type: 'join', name: 'Bo' }), /already started/);
});

test('moves alternate, reject invalid squares and outsiders, and preserve the previous state', () => {
  const game = playing();
  for (const cell of [-1, 9, 1.5, NaN, undefined, null, '0']) {
    assert.throws(() => applyAction(game, 'p0', { type: 'mark', cell: cell as number }), /valid square/);
  }
  assert.throws(() => applyAction(game, 'outsider', { type: 'mark', cell: 0 }), /Join/);
  assert.throws(() => applyAction(game, 'p1', { type: 'mark', cell: 0 }), /not your turn/);
  const moved = applyAction(game, 'p0', { type: 'mark', cell: 0 });
  assert.deepEqual(game.cells, Array(9).fill(null));
  assert.equal(moved.cells[0], 'X');
  assert.equal(moved.currentPlayer, 1);
  assert.throws(() => applyAction(moved, 'p0', { type: 'mark', cell: 1 }), /not your turn/);
  assert.throws(() => applyAction(moved, 'p1', { type: 'mark', cell: 0 }), /taken/);
  const replied = applyAction(moved, 'p1', { type: 'mark', cell: 4 });
  assert.equal(replied.cells[4], 'O');
  assert.equal(replied.currentPlayer, 0);
});

test('rows, columns, and both diagonals can win; finished games reject moves', () => {
  for (const moves of [
    [0, 3, 1, 4, 2], [3, 0, 4, 1, 5], [6, 0, 7, 1, 8],
    [0, 1, 3, 2, 6], [1, 0, 4, 2, 7], [2, 0, 5, 1, 8],
    [0, 1, 4, 2, 8], [2, 0, 4, 1, 6],
  ]) {
    const won = play(moves);
    assert.equal(won.status, 'finished');
    assert.deepEqual(won.winner, { id: 'p0', name: 'Astrid' });
    assert.throws(() => applyAction(won, 'p1', { type: 'mark', cell: 8 }), /not in progress/);
  }
  assert.deepEqual(play([0, 3, 1, 4, 8, 5]).winner, { id: 'p1', name: 'Bo' });
  assert.equal(play([0, 1, 2, 3, 4, 5, 7, 6, 8]).winner?.id, 'p0', 'a win on the ninth move beats a draw');
});

test('a full board without a winning line is a draw', () => {
  const drawn = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert.equal(drawn.status, 'finished');
  assert.equal(drawn.winner, undefined);
  assert.match(drawn.lastMove, /draw/);
});

test('leaving transfers hosting in the lobby, ends active games, and preserves played marks', () => {
  const joined = applyAction(createGame('p0', 'Astrid', 2), 'p1', { type: 'join', name: 'Bo' });
  const left = applyAction(joined, 'p0', { type: 'leave' });
  assert.equal(left.status, 'waiting');
  assert.equal(left.players[0].id, 'p1');
  assert.equal(left.players[0].mark, 'X');
  const rejoined = applyAction(left, 'p2', { type: 'join', name: 'Cia' });
  assert.equal(rejoined.players[1].mark, 'O');
  assert.equal(applyAction(rejoined, 'p1', { type: 'start' }).status, 'playing');
  assert.equal(applyAction(left, 'p1', { type: 'leave' }).status, 'finished');
  const active = play([0, 4]);
  assert.throws(() => applyAction(active, 'outsider', { type: 'leave' }), /Join/);
  const ended = applyAction(active, 'p0', { type: 'leave' });
  assert.equal(ended.status, 'finished');
  assert.equal(ended.players[0].mark, 'O');
  assert.deepEqual(ended.cells, active.cells);
  assert.equal(applyAction(ended, 'p1', { type: 'leave' }).players.length, 0);
  assert.equal(active.players.length, 2);
});
