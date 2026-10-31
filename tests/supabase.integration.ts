import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameRow } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import type { TicTacToe } from '../supabase/functions/_shared/games/tic-tac-toe/game.ts';
import { crofts } from '../supabase/functions/_shared/games/bondespelet/game.ts';

// Local development only. Keys stay in memory and are never logged.
const config = JSON.parse(execFileSync('node_modules/.bin/supabase', ['status', '--output', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
const url = config.API_URL as string;
assert.ok(url.startsWith('http://127.0.0.1:'), 'Integration tests must use local Supabase.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, config.SERVICE_ROLE_KEY, options);

test('private accounts, game limits, server moves, membership, persistence, and realtime', async () => {
  const clients: SupabaseClient[] = [];
  const userIds: string[] = [];
  const gameIds: string[] = [];
  async function move(client: SupabaseClient, action: object, row?: Pick<GameRow, 'id' | 'version'>) {
    return client.functions.invoke('game-action', {
      body: { action, gameId: row?.id, version: row?.version },
    });
  }
  async function chooseCrofts(row: GameRow) {
    for (const [i, id] of row.state.turnOrder!.entries()) {
      assert.equal(row.state.players[row.state.currentPlayer].id, id);
      const client = clients[userIds.indexOf(id)];
      assert.ok((await move(client, { type: 'roll' }, row)).error,
        'turn rolls must wait until every player chooses a croft');
      const selected = await move(client, { type: 'select-croft', croftId: crofts[i].id }, row);
      assert.ifError(selected.error);
      row = selected.data;
      assert.equal(row.state.players[row.state.currentPlayer].id, id, 'planting follows croft selection for the same player');
      for (const action of [{ type: 'plant', crop: 'wheat' }, { type: 'confirm-planting' }]) {
        assert.ok((await move(client, { type: 'roll' }, row)).error, 'everyone must finish preparation before rolling');
        const planted = await move(client, action, row);
        assert.ifError(planted.error);
        row = planted.data;
      }
      assert.ok(row.state.players.every((p) => p.position === 0));
    }
    assert.equal(row.state.plantingOrder, undefined);
    return row;
  }
  async function finishRolls(row: GameRow) {
    let attempts = 0;
    while (row.state.players.some((p) => p.roll === undefined)) {
      assert.ok(attempts++ < 100, 'opening rolls must eventually resolve');
      const player = [...row.state.players].reverse().find((p) => p.roll === undefined)!;
      const rolled = await move(clients[userIds.indexOf(player.id)], { type: 'roll' }, row);
      assert.ifError(rolled.error);
      row = rolled.data;
    }
    assert.equal(row.state.turnOrder?.length, row.state.players.length);
    assert.equal(row.state.players[row.state.currentPlayer].id, row.state.turnOrder![0]);
    return chooseCrofts(row);
  }
  try {
    for (let i = 0; i < 5; i++) {
      const client = createClient(url, config.ANON_KEY, options);
      const email = `farmer-${randomUUID()}@example.com`;
      const password = randomUUID();
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(error);
      userIds.push(data.user!.id);
      assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
      clients.push(client);
    }
    const publicClient = createClient(url, config.ANON_KEY, options);
    assert.ok((await publicClient.auth.signInAnonymously()).error, 'anonymous sign-ins must be disabled');
    assert.ok((await publicClient.auth.signUp({ email: `uninvited-${randomUUID()}@example.com`, password: randomUUID() })).error,
      'public sign-ups must be disabled');
    const unauthorized = await fetch(`${url}/functions/v1/game-action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'create', name: 'Fake', capacity: 2 } }),
    });
    assert.equal(unauthorized.status, 401);

    for (const count of [2, 3, 4]) {
      const created = await move(clients[0], { type: 'create', name: 'Astrid', capacity: count, color: 'red' });
      assert.ifError(created.error);
      let row = created.data as GameRow;
      gameIds.push(row.id);
      if (count === 2) {
        const legacy = structuredClone(row.state);
        delete legacy.kind;
        const saved = await admin.from('games').update({ state: legacy }).eq('id', row.id).select('id, version, state').single();
        assert.ifError(saved.error);
        row = saved.data!;
        assert.equal(row.state.kind, undefined, 'saved games from before game selection must remain playable');
      }
      assert.equal(row.state.players[0].color, 'red');
      assert.ok((await move(clients[0], { type: 'mark', cell: 0 }, row)).error, 'Bondespelet rejects tic-tac-toe moves');
      const outsider = clients[4];
      const read = await outsider.from('games').select('id').eq('id', row.id);
      assert.ifError(read.error);
      assert.deepEqual(read.data, [], 'nonmembers must not read the game');
      assert.ok((await outsider.from('games').insert({ state: row.state })).error);
      assert.ok((await clients[0].from('games').update({ version: 999 }).eq('id', row.id)).error);
      assert.ok((await clients[0].rpc('commit_game', { p_id: row.id, p_version: row.version, p_state: row.state })).error);
      assert.ok((await clients[0].rpc('create_game', { p_state: row.state })).error);
      const intrusion = await move(outsider, { type: 'end-turn' }, row);
      assert.ok(intrusion.error, 'nonmembers must not submit moves');
      assert.ok((await move(clients[1], { type: 'join', name: 'Bo', color: 'red' }, row)).error,
        'joining must reject a color already taken by the host');

      for (let i = 1; i < count; i++) {
        const color = ['yellow', 'green', 'blue'][i - 1];
        const joined = await move(clients[i], { type: 'join', name: `Farmer ${i}`, color }, row);
        assert.ifError(joined.error);
        row = joined.data;
        assert.equal(row.state.players[i].color, color);
      }
      assert.ok((await move(clients[1], { type: 'set-color', color: 'red' }, row)).error,
        'changing color must reject another player’s color');
      const recolored = await move(clients[1], { type: 'set-color', color: 'white' }, row);
      assert.ifError(recolored.error);
      row = recolored.data;
      assert.equal(row.state.players[1].color, 'white');
      const colorAttempts = await Promise.all([0, 1].map((i) => move(clients[i], { type: 'set-color', color: 'black' }, row)));
      assert.equal(colorAttempts.filter((result) => !result.error).length, 1);
      row = colorAttempts.find((result) => !result.error)!.data as GameRow;
      assert.equal(new Set(row.state.players.map((p) => p.color)).size, row.state.players.length);
      assert.ok((await move(outsider, { type: 'join', name: 'Extra' }, row)).error);
      assert.ok((await move(clients[1], { type: 'start' }, row)).error);
      const started = await move(clients[0], { type: 'start' }, row);
      assert.ifError(started.error);
      row = started.data;
      assert.ok((await move(clients[0], { type: 'select-croft', croftId: 13 }, row)).error,
        'croft selection must wait until turn order is decided');
      const changedDuringPlay = await move(clients[1], { type: 'set-color', color: 'yellow' }, row);
      assert.ifError(changedDuringPlay.error);
      row = changedDuringPlay.data;
      assert.equal(row.state.players[1].color, 'yellow');
      assert.equal(row.state.currentPlayer, 0);
      assert.ok((await move(clients[1], { type: 'end-turn' }, row)).error);
      assert.ok((await move(clients[0], { type: 'end-turn' }, row)).error,
        'ending turns must wait until everyone has rolled');
      const rolls = await Promise.all([0, 1].map(() => move(clients[count - 1], { type: 'roll', roll: 99 }, row)));
      assert.equal(rolls.filter((result) => !result.error).length, 1, 'only one concurrent roll may be saved');
      row = rolls.find((result) => !result.error)!.data as GameRow;
      assert.ok((await move(clients[count - 1], { type: 'roll' }, row)).error, 'players cannot roll twice in one round');
      for (let i = count - 2; i >= 0; i--) {
        assert.ok((await move(clients[i], { type: 'end-turn' }, row)).error);
        const rolled = await move(clients[i], { type: 'roll' }, row);
        assert.ifError(rolled.error);
        row = rolled.data;
      }
      row = await finishRolls(row);
      assert.ok(row.state.players.every((p) => Number.isInteger(p.roll) && p.roll! >= 1 && p.roll! <= 6));
      const first = clients[row.state.currentPlayer];
      assert.ok((await move(first, { type: 'end-turn' }, row)).error, 'turns must begin by rolling to move');
      const turnRolls = await Promise.all([0, 1].map(() => move(first, { type: 'roll', roll: 99, position: 99 }, row)));
      assert.equal(turnRolls.filter((result) => !result.error).length, 1, 'only one turn roll may be saved');
      row = turnRolls.find((result) => !result.error)!.data as GameRow;
      assert.equal(row.state.players[row.state.currentPlayer].position, row.state.turnRoll!);
      assert.ok((await move(first, { type: 'roll' }, row)).error, 'players cannot roll twice in one turn');
      const passed = await move(first, { type: 'end-turn' }, row);
      assert.ifError(passed.error);
      row = passed.data;
      assert.equal(row.state.turnRoll, undefined);
      assert.equal(row.state.players[row.state.currentPlayer].id, row.state.turnOrder![1]);
      assert.ok((await move(clients[row.state.currentPlayer], { type: 'plant', crop: 'wheat' }, row)).error,
        'initial planting must not repeat during normal turns');
      const moved = await move(clients[row.state.currentPlayer], { type: 'roll' }, row);
      assert.ifError(moved.error);
      row = moved.data;

      // Two submissions using one version must yield exactly one accepted move.
      const attempts = await Promise.all([0, 1].map(() => move(clients[row.state.currentPlayer], { type: 'end-turn' }, row)));
      assert.equal(attempts.filter((r) => !r.error).length, 1);
      const accepted = attempts.find((r) => !r.error)!.data as GameRow;
      assert.equal(accepted.version, row.version + 1);
      assert.ok((await move(first, { type: 'end-turn' }, row)).error, 'stale versions must fail');
      row = accepted;

      assert.equal(row.state.status, 'playing');
      assert.ok(row.state.players.every((p) => p.score === 0));
      assert.ok(row.state.fields.every((f) => f.owner === null));
      while (row.state.status === 'playing') {
        const player = row.state.players.find((p) => p.id !== userIds[1])!;
        const left = await move(clients[userIds.indexOf(player.id)], { type: 'leave' }, row);
        assert.ifError(left.error);
        row = left.data;
      }
      assert.equal(row.state.status, 'finished');
      const persisted = await clients[1].from('games').select('id, version, state').eq('id', row.id).single();
      assert.ifError(persisted.error);
      assert.deepEqual(persisted.data, row);
      assert.ok((await move(clients[1], { type: 'end-turn' }, row)).error);
      assert.ok((await move(outsider, { type: 'leave' }, row)).error);
      const left = await move(clients[1], { type: 'leave' }, row);
      assert.ifError(left.error);
      assert.ok((left.data as GameRow).state.players.every((p) => p.id !== userIds[1]));
      const afterLeaving = await clients[1].from('games').select('id').eq('id', row.id);
      assert.ifError(afterLeaving.error);
      assert.deepEqual(afterLeaving.data, [], 'leaving must remove game membership');
      assert.ok((await move(clients[1], { type: 'leave' }, left.data)).error);
    }

    assert.ok((await move(clients[0], { type: 'create', kind: 'unknown', name: 'Invalid', capacity: 2 })).error);
    assert.ok((await move(clients[0], { type: 'create', kind: 'tic-tac-toe', name: 'Invalid', capacity: 3 })).error);
    const sampleCreated = await move(clients[0], { type: 'create', kind: 'tic-tac-toe', name: 'Sample host', capacity: 2 });
    assert.ifError(sampleCreated.error);
    let sample = sampleCreated.data as GameRow<TicTacToe>;
    gameIds.push(sample.id);
    assert.equal(sample.state.kind, 'tic-tac-toe');
    assert.deepEqual(sample.state.cells, Array(9).fill(null));
    const privateSample = await clients[1].from('games').select('id').eq('id', sample.id);
    assert.ifError(privateSample.error);
    assert.deepEqual(privateSample.data, [], 'sample games use the same private membership rules');
    assert.ok((await move(clients[1], { type: 'mark', cell: 0 }, sample)).error);
    assert.ok((await move(clients[0], { type: 'mark', cell: 0 }, sample)).error, 'sample games must start before playing');
    assert.ok((await move(clients[0], { type: 'roll', kind: 'bondespelet' }, sample)).error, 'moves use the saved game type');
    const sampleJoined = await move(clients[1], { type: 'join', name: 'Sample friend' }, sample);
    assert.ifError(sampleJoined.error);
    sample = sampleJoined.data;
    assert.equal(sample.state.players[1].mark, 'O');
    assert.ok((await move(clients[1], { type: 'start' }, sample)).error, 'only the sample host can start');
    const sampleStarted = await move(clients[0], { type: 'start' }, sample);
    assert.ifError(sampleStarted.error);
    sample = sampleStarted.data;
    assert.ok((await move(clients[2], { type: 'join', name: 'Late' }, sample)).error);
    assert.ok((await move(clients[1], { type: 'mark', cell: 0 }, sample)).error, 'sample turns are enforced');
    const sampleStale = sample;
    const sampleMoves = await Promise.all([0, 1].map(() => move(clients[0], { type: 'mark', cell: 0 }, sample)));
    assert.equal(sampleMoves.filter((result) => !result.error).length, 1, 'only one concurrent sample move is saved');
    sample = sampleMoves.find((result) => !result.error)!.data;
    assert.equal(sample.version, sampleStale.version + 1);
    assert.equal(sample.state.cells[0], 'X');
    assert.ok((await move(clients[1], { type: 'mark', cell: 3 }, sampleStale)).error, 'stale sample moves must fail');
    assert.ok((await move(clients[1], { type: 'mark', cell: 0 }, sample)).error, 'occupied squares are rejected');
    const sampleReloaded = await clients[1].from('games').select('id, version, state').eq('id', sample.id).single();
    assert.ifError(sampleReloaded.error);
    assert.deepEqual(sampleReloaded.data, sample, 'the sample board persists for both players');
    for (const cell of [3, 1, 4, 2]) {
      const moved = await move(clients[sample.state.currentPlayer], { type: 'mark', cell }, sample);
      assert.ifError(moved.error);
      sample = moved.data;
    }
    assert.equal(sample.state.status, 'finished');
    assert.equal(sample.state.winner?.id, userIds[0]);
    assert.ok((await move(clients[1], { type: 'mark', cell: 8 }, sample)).error);
    const sampleLeft = await move(clients[0], { type: 'leave' }, sample);
    assert.ifError(sampleLeft.error);
    assert.equal(sampleLeft.data.state.players[0].mark, 'O', 'leaving a finished board preserves player marks');
    const sampleAfterLeaving = await clients[0].from('games').select('id').eq('id', sample.id);
    assert.ifError(sampleAfterLeaving.error);
    assert.deepEqual(sampleAfterLeaving.data, [], 'leaving a sample game removes read access');

    const created = await move(clients[0], { type: 'create', name: 'Realtime host', capacity: 2 });
    assert.ifError(created.error);
    const row = created.data as GameRow;
    gameIds.push(row.id);
    let channel: ReturnType<SupabaseClient['channel']> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Realtime update timed out.')), 15000);
        channel = clients[0].channel('integration-updates')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${row.id}` }, () => {
            clearTimeout(timeout);
            resolve();
          })
          .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timeout);
              reject(new Error(`Realtime ${status}: ${error?.message ?? 'Subscription failed.'}`));
            }
            if (status === 'SUBSCRIBED') void move(clients[1], { type: 'join', name: 'Realtime friend' }, row).then(({ error }) => {
              if (error) { clearTimeout(timeout); reject(error); }
            });
          });
      });
    } finally { if (channel) await clients[0].removeChannel(channel); }

    const { count, error: countError } = await admin.from('games').select('id', { count: 'exact', head: true })
      .in('state->>status', ['waiting', 'playing']);
    assert.ifError(countError);
    const available = 5 - count!;
    const attempts = await Promise.all(Array.from({ length: available + 2 }, (_, i) =>
      move(clients[i % clients.length], { type: 'create', kind: i % 2 ? 'tic-tac-toe' : 'bondespelet', name: 'Limit test', capacity: 2 })));
    const accepted = attempts.filter((result) => !result.error);
    gameIds.push(...accepted.map((result) => (result.data as GameRow).id));
    assert.equal(accepted.length, available, 'concurrent creation must respect the shared game limit');
    for (const result of attempts.filter((result) => result.error)) {
      assert.equal(result.error.context.status, 409);
      assert.match((await result.error.context.json()).error, /5 unfinished games/);
    }
    const lobby = await admin.from('games').select('id, version, state').eq('id', row.id).single();
    assert.ifError(lobby.error);
    const started = await move(clients[0], { type: 'start' }, lobby.data!);
    assert.ifError(started.error);
    let active = started.data as GameRow;
    assert.equal(active.state.status, 'playing');
    assert.ok((await move(clients[1], { type: 'create', kind: 'tic-tac-toe', name: 'Still full', capacity: 2 })).error,
      'all game types share the unfinished-game limit');
    active = await finishRolls(active);
    const departed = await move(clients[1], { type: 'leave' }, active);
    assert.ifError(departed.error);
    active = departed.data;
    assert.equal(active.state.status, 'finished');
    const replacement = await move(clients[1], { type: 'create', name: 'Freed slot', capacity: 2 });
    assert.ifError(replacement.error);
    const waiting = replacement.data as GameRow;
    gameIds.push(waiting.id);
    assert.ok((await move(clients[0], { type: 'end' }, waiting)).error);
    const ended = await move(clients[1], { type: 'end' }, waiting);
    assert.ifError(ended.error);
    assert.equal((ended.data as GameRow).state.status, 'finished');
    const afterEnding = await move(clients[1], { type: 'create', name: 'Ended lobby freed a slot', capacity: 2 });
    assert.ifError(afterEnding.error);
    gameIds.push((afterEnding.data as GameRow).id);
  } finally {
    for (const client of clients) await client.removeAllChannels();
    if (gameIds.length) await admin.from('games').delete().in('id', gameIds);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  }
});
