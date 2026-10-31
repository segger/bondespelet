import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import type { Action, GameRow } from '../supabase/functions/_shared/games.ts';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function sendAction(action: Action, gameId?: string, version?: number): Promise<GameRow> {
  if (!supabase) throw new Error('Configure Supabase first.');
  const { data, error } = await supabase.functions.invoke('game-action', {
    body: { action, gameId, version },
  });
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    throw new Error(body?.error ?? 'Unable to complete your move.');
  }
  if (error) throw error;
  return data as GameRow;
}
