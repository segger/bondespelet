import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, crofts } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import type { Action, PlayerColor } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import { chooseCrofts, endTurn, playing, roll } from './game-helpers.ts';

for (const count of [2, 3, 4]) {
  test(`${count} players choose a croft and plant in the same preparation turn`, () => {
    let game = playing(count, false);
    assert.throws(() => applyAction(game, 'p0', { type: 'select-croft', croftId: 13 }), /Decide turn order/);
    for (let i = 0; i < count; i++) game = roll(game, i + 1);
    const order = [...game.turnOrder!];
    assert.equal(order[0], `p${count - 1}`);
    for (const [i, id] of order.entries()) {
      assert.equal(game.players[game.currentPlayer].id, id);
      for (const type of ['roll', 'end-turn'] as const) {
        assert.throws(() => applyAction(game, id, { type }), /Every player must choose a croft/);
      }
      const other = game.players.find((p) => p.id !== id && p.croft === undefined);
      if (other) assert.throws(() => applyAction(game, other.id, { type: 'select-croft', croftId: crofts[i].id }), /not your turn/);
      game = applyAction(game, id, { type: 'select-croft', croftId: crofts[i].id });
      assert.throws(() => applyAction(game, id, { type: 'select-croft', croftId: 1 }), /already chosen/);
      assert.equal(game.players[game.currentPlayer].id, id, 'choosing a croft keeps the same player active');
      if (other) assert.throws(() => applyAction(game, other.id, { type: 'select-croft', croftId: crofts[i + 1].id }), /not your turn/);
      assert.throws(() => applyAction(game, id, { type: 'roll' }), /before playing turns/);
      game = applyAction(game, id, { type: 'plant', crop: 'wheat' });
      assert.equal(game.players[game.currentPlayer].id, id, 'planting keeps the same player active');
      game = applyAction(game, id, { type: 'confirm-planting' });
      assert.equal(game.players[game.currentPlayer].id, order[(i + 1) % count]);
    }
    assert.equal(game.players[game.currentPlayer].id, order[0]);
    game = chooseCrofts(game);
    assert.equal(roll(game, 6, order[0]).turnRoll, 6);
    assert.ok(game.players.every((p) => p.position === 0));
  });
}

test('croft selections reject waiting games, ties, outsiders, invalid regions and taken crofts', () => {
  assert.throws(() => applyAction(createGame('p0', 'Astrid', 2), 'p0', { type: 'select-croft', croftId: 13 }), /Decide turn order/);
  let game = roll(roll(playing(2, false), 6), 6);
  assert.throws(() => applyAction(game, 'p0', { type: 'select-croft', croftId: 13 }), /Decide turn order/);
  game = roll(roll(game, 6), 5);
  assert.throws(() => applyAction(game, 'outsider', { type: 'select-croft', croftId: 13 }), /Join/);
  for (const croftId of [0, -1, 2, 23, NaN, '13', null]) {
    assert.throws(() => applyAction(game, 'p0', { type: 'select-croft', croftId } as Action), /valid croft/);
  }
  for (const { id } of crofts) {
    let selected = applyAction(game, 'p0', { type: 'select-croft', croftId: id });
    assert.equal(selected.players[0].croft, id);
    assert.equal(selected.players[1].croft, undefined);
    assert.equal(game.players[0].croft, undefined);
    assert.throws(() => applyAction(selected, 'p1', { type: 'select-croft', croftId: id }), /not your turn/);
    selected = applyAction(selected, 'p0', { type: 'plant', crop: 'wheat' });
    selected = applyAction(selected, 'p0', { type: 'confirm-planting' });
    assert.throws(() => applyAction(selected, 'p1', { type: 'select-croft', croftId: id }), /already taken/);
  }
  const finished = applyAction(game, 'p1', { type: 'leave' });
  assert.throws(() => applyAction(finished, 'p0', { type: 'select-croft', croftId: 13 }), /Decide turn order/);
});

test('leaving during croft selection preserves selection order and releases the croft', () => {
  let game = playing(4, false);
  for (const face of [2, 6, 1, 4]) game = roll(game, face);
  game = applyAction(game, 'p1', { type: 'select-croft', croftId: 13 });
  game = applyAction(game, 'p1', { type: 'leave' });
  assert.equal(game.players[game.currentPlayer].id, 'p3');
  game = applyAction(game, 'p3', { type: 'select-croft', croftId: 13 });
  game = applyAction(game, 'p3', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'leave' });
  assert.equal(game.players[game.currentPlayer].id, 'p3');
  assert.equal(game.players[game.currentPlayer].pendingCrops, 1);
  game = applyAction(game, 'p3', { type: 'confirm-planting' });
  assert.equal(game.players[game.currentPlayer].id, 'p2');
  game = applyAction(game, 'p2', { type: 'select-croft', croftId: 15 });
  assert.equal(game.players[game.currentPlayer].id, 'p2');
  assert.equal(roll(chooseCrofts(game), 1, 'p3').turnRoll, 1);
});

test('preparation completes when the last player without a croft leaves', () => {
  let game = playing(3, false);
  for (const face of [6, 5, 4]) game = roll(game, face);
  game = applyAction(game, 'p0', { type: 'select-croft', croftId: 13 });
  game = applyAction(game, 'p0', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p0', { type: 'confirm-planting' });
  game = applyAction(game, 'p1', { type: 'select-croft', croftId: 15 });
  game = applyAction(game, 'p1', { type: 'plant', crop: 'wheat' });
  game = applyAction(game, 'p1', { type: 'confirm-planting' });
  game = applyAction(game, 'p2', { type: 'leave' });
  assert.equal(game.plantingOrder, undefined);
  assert.equal(game.players[game.currentPlayer].id, 'p0');
  assert.equal(roll(chooseCrofts(game), 1, 'p0').turnRoll, 1);
});

test('opening rolls reject outsiders, duplicate rolls, and rolls outside active games', () => {
  const lobby = createGame('p0', 'Astrid', 2);
  assert.throws(() => applyAction(lobby, 'p0', { type: 'roll' }), /not in progress/);
  const game = playing(2, false);
  assert.throws(() => applyAction(game, 'outsider', { type: 'roll' }), /Join/);
  const rolled = roll(game, 4, 'p1');
  assert.equal(rolled.players[1].roll, 4);
  assert.throws(() => applyAction(rolled, 'p1', { type: 'roll' }), /already rolled/);
  const finished = applyAction(game, 'p1', { type: 'leave' });
  assert.throws(() => applyAction(finished, 'p0', { type: 'roll' }), /not in progress/);
});

test('the server can roll each of the six faces and ignores a supplied result', (t) => {
  const random = t.mock.method(Math, 'random');
  for (let face = 1; face <= 6; face++) {
    random.mock.mockImplementation(() => (face - 1) / 6);
    const game = playing(2, false);
    const rolled = applyAction(game, 'p0', { type: 'roll', roll: 99 } as Action);
    assert.equal(rolled.players[0].roll, face);
    assert.equal(game.players[0].roll, undefined);
    assert.deepEqual(rolled.fields, game.fields);
    assert.ok(rolled.players.every((p) => p.score === 0));
  }
});

for (const count of [2, 3, 4]) {
  test(`${count} players can roll in reverse join order before normal turns begin`, () => {
    let game = playing(count, false);
    for (let i = count - 1; i >= 0; i--) {
      assert.throws(() => applyAction(game, `p${i}`, { type: 'end-turn' }), /Every player must roll/);
      game = roll(game, 6 - i, `p${i}`);
      assert.ok(Number.isInteger(game.players[i].roll));
      assert.ok(game.players[i].roll! >= 1 && game.players[i].roll! <= 6);
      if (!game.turnOrder) assert.throws(() => applyAction(game, `p${i}`, { type: 'roll' }), /already rolled/);
    }
    assert.equal(game.currentPlayer, 0);
    assert.deepEqual(game.turnOrder, Array.from({ length: count }, (_, i) => `p${i}`));
    assert.equal(game.turnRoll, undefined);
    assert.ok(game.players.every((p) => p.position === 0));
    const ended = endTurn(chooseCrofts(game), 'p0');
    assert.deepEqual(ended.players.map((p) => p.roll), game.players.map((p) => p.roll));
    assert.equal(ended.currentPlayer, 1);
    assert.equal(roll(ended, 2, 'p1').players[1].position, 2);
  });
}

test('opening rolls set descending turn order without changing the host or player colors', () => {
  let game = playing(4, false);
  const players = game.players.map(({ id, color }) => ({ id, color }));
  for (const face of [2, 6, 1, 4]) game = roll(game, face);
  assert.deepEqual(game.turnOrder, ['p1', 'p3', 'p0', 'p2']);
  assert.deepEqual(game.players.map(({ id, color }) => ({ id, color })), players);
  game = chooseCrofts(game);
  for (const id of ['p1', 'p3', 'p0', 'p2', 'p1']) {
    assert.equal(game.players[game.currentPlayer].id, id);
    const other = game.players.find((p) => p.id !== id)!;
    assert.throws(() => applyAction(game, other.id, { type: 'end-turn' }), /not your turn/);
    game = endTurn(game, id);
  }
});

test('only tied players reroll repeatedly in any order, keeping their group ahead of lower opening rolls', () => {
  let game = playing(4, false);
  for (const face of [6, 6, 5, 2]) game = roll(game, face);
  assert.equal(game.turnOrder, undefined);
  assert.deepEqual(game.players.map((p) => p.roll), [undefined, undefined, 5, 2]);
  assert.throws(() => applyAction(game, 'p0', { type: 'end-turn' }), /must roll/);
  assert.throws(() => applyAction(game, 'p2', { type: 'roll' }), /already rolled/);
  const previous = game;
  game = roll(game, 3, 'p1');
  assert.equal(game.players[0].roll, undefined);
  assert.equal(previous.players[1].roll, undefined);
  assert.throws(() => applyAction(game, 'p1', { type: 'roll' }), /already rolled/);
  game = roll(game, 3, 'p0');
  assert.deepEqual(game.players.map((p) => p.roll), [undefined, undefined, 5, 2]);
  game = roll(game, 2, 'p1');
  assert.throws(() => applyAction(game, 'p1', { type: 'end-turn' }), /must roll/);
  game = roll(game, 1, 'p0');
  assert.deepEqual(game.turnOrder, ['p1', 'p0', 'p2', 'p3']);
  assert.deepEqual(game.players.map((p) => p.rolls), [[6, 3, 1], [6, 3, 2], [5], [2]]);
  assert.equal(game.players[game.currentPlayer].id, 'p1');
  assert.equal(roll(chooseCrofts(game), 1, 'p1').players[1].position, 1);
});

test('multiple tied groups and a three-way tie can split into smaller ties', () => {
  let game = playing(4, false);
  for (const face of [6, 6, 2, 2, 1, 2, 6, 5]) game = roll(game, face);
  assert.deepEqual(game.turnOrder, ['p1', 'p0', 'p2', 'p3']);

  game = playing(4, false);
  for (const face of [4, 4, 4, 6, 2, 5, 2]) game = roll(game, face);
  assert.deepEqual(game.players.map((p) => p.roll), [undefined, 5, undefined, 6]);
  assert.equal(game.players[game.currentPlayer].id, 'p0');
  for (const face of [6, 1]) game = roll(game, face);
  assert.deepEqual(game.turnOrder, ['p3', 'p1', 'p0', 'p2']);
});

test('the host can start with three players without filling all four seats', () => {
  let lobby = createGame('p0', 'Astrid', 4);
  lobby = applyAction(lobby, 'p1', { type: 'join', name: 'Bo' });
  lobby = applyAction(lobby, 'p2', { type: 'join', name: 'Cia' });
  assert.deepEqual(lobby.players.map((p) => p.money), [10_000, 10_000, 10_000]);
  const started = applyAction(lobby, 'p0', { type: 'start' });
  assert.deepEqual(started.players.map((p) => p.money), [10_000, 10_000, 10_000]);
  assert.equal(started.status, 'playing');
  assert.equal(started.players.length, 3);
  assert.equal(lobby.status, 'waiting');
  assert.throws(() => applyAction(started, 'p3', { type: 'join', name: 'Dan' }), /already started/);
});

test('older players receive starting money without resetting existing balances', () => {
  const lobby = applyAction(createGame('p0', 'Astrid', 2), 'p1', { type: 'join', name: 'Bo' });
  delete lobby.players[0].money;
  lobby.players[1].money = 0;
  const started = applyAction(lobby, 'p0', { type: 'start' });
  assert.deepEqual(started.players.map((p) => p.money), [10_000, 0]);
  assert.equal(lobby.players[0].money, undefined);
});

test('players choose any of the six colors when creating or joining a game', () => {
  for (const color of ['black', 'red', 'green', 'blue', 'yellow', 'white'] as const) {
    assert.equal(createGame('p0', 'Astrid', 2, color).players[0].color, color);
    const lobby = createGame('p0', 'Astrid', 2, color === 'black' ? 'red' : 'black');
    const joined = applyAction(lobby, 'p1', { type: 'join', name: 'Bo', color });
    assert.equal(joined.players[1].color, color);
    assert.equal(applyAction(joined, 'p0', { type: 'start' }).players[1].color, color);
  }
  for (const color of ['purple', '', 123, {}]) {
    assert.throws(() => createGame('p0', 'Astrid', 2, color as PlayerColor), /Choose black/);
    assert.throws(() => applyAction(createGame('p0', 'Astrid', 2), 'p1', {
      type: 'join', name: 'Bo', color: color as PlayerColor,
    }), /Choose black/);
  }
});

test('colors are exclusive within a game and become available when changed or released', () => {
  const lobby = createGame('p0', 'Astrid', 4, 'red');
  assert.throws(() => applyAction(lobby, 'p1', { type: 'join', name: 'Bo', color: 'red' }), /already taken/);
  const joined = applyAction(lobby, 'p1', { type: 'join', name: 'Bo' });
  assert.equal(joined.players[1].color, 'black', 'omitting a color chooses an available one');
  assert.throws(() => applyAction(joined, 'p1', { type: 'set-color', color: 'red' }), /already taken/);
  assert.equal(applyAction(joined, 'p0', { type: 'set-color', color: 'red' }).players[0].color, 'red');
  assert.equal(joined.players[1].color, 'black');
  const changed = applyAction(joined, 'p0', { type: 'set-color', color: 'white' });
  const reused = applyAction(changed, 'p1', { type: 'set-color', color: 'red' });
  assert.equal(reused.players[1].color, 'red');
  const left = applyAction(reused, 'p0', { type: 'leave' });
  assert.equal(applyAction(left, 'p2', { type: 'join', name: 'Cia', color: 'white' }).players[1].color, 'white');
  assert.equal(createGame('other-host', 'Dan', 2, 'red').players[0].color, 'red');
});

test('colors displayed for players in older games are also reserved', () => {
  const lobby = applyAction(createGame('p0', 'Astrid', 4), 'p1', { type: 'join', name: 'Bo' });
  delete lobby.players[1].color;
  assert.throws(() => applyAction(lobby, 'p2', { type: 'join', name: 'Cia', color: 'red' }), /already taken/);
  assert.throws(() => applyAction(lobby, 'p0', { type: 'set-color', color: 'red' }), /already taken/);
  let legacy = createGame('p0', 'Astrid', 4, 'white');
  legacy = applyAction(legacy, 'p1', { type: 'join', name: 'Bo', color: 'red' });
  legacy = applyAction(legacy, 'p2', { type: 'join', name: 'Cia', color: 'black' });
  delete legacy.players[1].color;
  const left = applyAction(legacy, 'p0', { type: 'leave' });
  assert.equal(left.players[0].color, 'red', 'leaving must not shift an older player to a taken color');
  assert.equal(left.players[1].color, 'black');
});

test('players can change only their own color', () => {
  const lobby = applyAction(createGame('p0', 'Astrid', 2, 'red'), 'p1', { type: 'join', name: 'Bo', color: 'blue' });
  const changed = applyAction(lobby, 'p1', { type: 'set-color', color: 'white' });
  assert.equal(changed.players[1].color, 'white');
  assert.equal(changed.players[0].color, 'red');
  assert.equal(lobby.players[1].color, 'blue');
  assert.throws(() => applyAction(lobby, 'outsider', { type: 'set-color', color: 'white' }), /Join/);
  assert.throws(() => applyAction(lobby, 'p0', { type: 'set-color', color: 'purple' as PlayerColor }), /Choose black/);
  delete lobby.players[1].color;
  assert.equal(applyAction(lobby, 'p1', { type: 'set-color', color: 'yellow' }).players[1].color, 'yellow');
});

test('players can change color during play without affecting turns, fields or scores', () => {
  const game = endTurn(playing(), 'p0');
  const changed = applyAction(game, 'p0', { type: 'set-color', color: 'yellow' });
  assert.equal(changed.players[0].color, 'yellow');
  assert.equal(game.players[0].color, 'black');
  assert.equal(changed.status, game.status);
  assert.equal(changed.currentPlayer, game.currentPlayer);
  assert.deepEqual(changed.fields, game.fields);
  assert.deepEqual(changed.players.map((p) => p.score), game.players.map((p) => p.score));
  assert.throws(() => applyAction(game, 'p0', { type: 'set-color', color: 'red' }), /already taken/);
  assert.throws(() => applyAction(game, 'outsider', { type: 'set-color', color: 'yellow' }), /Join/);
});
