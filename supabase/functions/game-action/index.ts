import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { applyAction, createGame } from '../_shared/games.ts';
import type { Action, GameRow } from '../_shared/games.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply({ error: 'Sign in first.' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply({ error: 'Your session expired. Sign in again.' }, 401);
  if (user.is_anonymous) return reply({ error: 'Sign in with an account provided by the host.' }, 403);

  try {
    const body = await request.json();
    const action = body?.action as Action | undefined;
    if (!action || typeof action !== 'object') return reply({ error: 'Missing action.' }, 400);

    if (action.type === 'create') {
      const state = createGame(user.id, action);
      const { data, error } = await admin.rpc('create_game', { p_state: state }).select('id, version, state').single();
      if (error?.code === 'P0001') return reply({ error: error.message }, 409);
      if (error) throw error;
      return reply(data);
    }

    if (typeof body.gameId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.gameId)) {
      return reply({ error: 'Invalid game link.' }, 400);
    }
    const { data, error } = await admin.from('games').select('id, version, state').eq('id', body.gameId).maybeSingle();
    if (error) throw error;
    if (!data) return reply({ error: 'Game not found.' }, 404);
    const game = data as GameRow;
    if (action.type !== 'join' && body.version !== game.version) {
      return reply({ error: 'The game changed. Refresh and try again.' }, 409);
    }
    const state = applyAction(game.state, user.id, action);
    const { data: saved, error: saveError } = await admin.rpc('commit_game', {
      p_id: game.id, p_version: game.version, p_state: state,
    }).select('id, version, state').maybeSingle();
    if (saveError) throw saveError;
    if (!saved) return reply({ error: 'Another player just moved. Refresh and try again.' }, 409);
    return reply(saved);
  } catch (error) {
    if (error instanceof Error || error instanceof SyntaxError) {
      return reply({ error: error.message }, 400);
    }
    console.error('Game action failed', error);
    return reply({ error: 'Unable to save the game. Please try again.' }, 500);
  }
});
