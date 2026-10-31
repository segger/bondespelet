import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame } from '../supabase/functions/_shared/games.ts';
import type { Action, GameState } from '../supabase/functions/_shared/games.ts';
import type { GameKind } from '../supabase/functions/_shared/catalog.ts';

test('the selected game has its own state and accepts only its own moves', () => {
  const farm = createGame('p0', { type: 'create', kind: 'bondespelet', name: 'Astrid', capacity: 4 });
  assert.equal(farm.kind, 'bondespelet');
  assert.equal(farm.capacity, 4);
  assert.throws(() => applyAction(farm, 'p0', { type: 'mark', cell: 0 }), /Unknown Bondespelet action/);
  const sample = createGame('p0', { type: 'create', kind: 'tic-tac-toe', name: 'Astrid', capacity: 2 });
  assert.equal(sample.kind, 'tic-tac-toe');
  assert.ok(!('fields' in sample));
  for (const action of [
    { type: 'roll' }, { type: 'plant', crop: 'wheat' }, { type: 'set-debug', enabled: true },
    { type: 'set-color', color: 'red' }, { type: 'change-building', buildingId: 13 },
  ] as Action[]) assert.throws(() => applyAction(sample, 'p0', action), /Unknown tic-tac-toe action/);
});

test('old create requests and saved games without a kind still use Bondespelet', () => {
  const legacy = createGame('p0', { type: 'create', name: 'Astrid', capacity: 2 });
  assert.equal(legacy.kind, 'bondespelet');
  delete legacy.kind;
  const joined = applyAction(legacy, 'p1', { type: 'join', name: 'Bo' });
  assert.equal(joined.players.length, 2);
  const started = applyAction(joined, 'p0', { type: 'start' });
  assert.equal(started.status, 'playing');
  assert.ok('fields' in started);
  assert.equal(started.players[0].name, 'Astrid');
});

test('unknown game types cannot fall back to a different game', () => {
  assert.throws(() => createGame('p0', { type: 'create', kind: 'unknown' as GameKind, name: 'Astrid', capacity: 2 }), /Unknown game type/);
  const saved = { kind: 'unknown' } as unknown as GameState;
  assert.throws(() => applyAction(saved, 'p0', { type: 'start' }), /Unknown game type/);
});
