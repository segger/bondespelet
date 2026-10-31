import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Action, GameRow } from '../supabase/functions/_shared/games.ts';
import type { GameKind } from '../supabase/functions/_shared/catalog.ts';
import { sendAction, supabase } from './api.ts';

const initialGameId = () => new URLSearchParams(location.search).get('game') ?? '';

export function useGameLifecycle() {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gameId, setGameId] = useState(initialGameId);
  const [lobby, setLobby] = useState(() => new URLSearchParams(location.search).has('lobby'));
  const [game, setGame] = useState<GameRow | null>(null);
  const [recent, setRecent] = useState<GameRow[]>([]);
  const [name, setName] = useState(localStorage.getItem('player-name') ?? localStorage.getItem('farmer-name') ?? '');
  const [kind, setKind] = useState<GameKind>('bondespelet');
  const [capacity, setCapacity] = useState(2);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user.is_anonymous ? '' : session?.user.id ?? '');
      if (!session || session.user.is_anonymous) { setGame(null); setRecent([]); }
      setLoading(false);
    });
    async function restoreSession() {
      const { data, error: sessionError } = await supabase!.auth.getSession();
      if (sessionError) throw sessionError;
      if (data.session?.user.is_anonymous) await supabase!.auth.signOut();
    }
    void restoreSession().catch((err: Error) => {
      if (active) { setError(err.message); setLoading(false); }
    });
    const onPopState = () => {
      const id = initialGameId();
      setGameId(id);
      setLobby(new URLSearchParams(location.search).has('lobby'));
      setGame((current) => current?.id === id ? current : null);
    };
    window.addEventListener('popstate', onPopState);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('popstate', onPopState); };
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    setLoading(true);
    setError('');
    const query = gameId
      ? supabase.from('games').select('id, version, state').eq('id', gameId)
      : supabase.from('games').select('id, version, state').order('updated_at', { ascending: false }).limit(8);
    void query.then(({ data, error: readError }) => {
      if (!active) return;
      if (readError) setError(readError.message);
      if (gameId) {
        const row = data?.[0] as GameRow | undefined;
        setGame((current) => row && current?.id === row.id && current.version > row.version ? current : row ?? null);
      } else setRecent((data ?? []) as GameRow[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, [gameId, userId]);

  const joinedId = game?.id;
  useEffect(() => {
    if (!supabase || !joinedId) return;
    const client = supabase;
    let active = true;
    const refresh = async () => {
      const { data, error: readError } = await client.from('games').select('id, version, state').eq('id', joinedId).single();
      if (!active) return;
      if (readError) { setError('Unable to refresh the game. Check your connection.'); return; }
      const row = data as GameRow;
      setGame((current) => current?.id === row.id && current.version > row.version ? current : row);
    };
    const channel = client.channel(`game:${joinedId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${joinedId}` }, () => { void refresh(); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh(); });
    // Refetch after reconnects/tab changes; polling also covers missed events.
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      void client.removeChannel(channel);
    };
  }, [joinedId]);

  function navigate(id: string, toLobby = false) {
    history.pushState(null, '', id ? `?game=${id}${toLobby ? '&lobby' : ''}` : location.pathname);
    setGameId(id);
    setLobby(toLobby);
    setGame((current) => current?.id === id ? current : null);
    setError('');
    setNotice('');
  }

  async function act(action: Action) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await sendAction(action, gameId || undefined, game?.version);
      if (action.type === 'leave' || action.type === 'end') { navigate(''); return; }
      if (action.type === 'start') navigate(saved.id);
      localStorage.setItem('player-name', name.trim());
      if (saved.id !== gameId) {
        history.pushState(null, '', `?game=${saved.id}`);
        setGameId(saved.id);
      }
      setGame((current) => current?.id === saved.id && current.version > saved.version ? current : saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      if (supabase && gameId && game) {
        const { data } = await supabase.from('games').select('id, version, state').eq('id', gameId).maybeSingle();
        if (data) setGame(data as GameRow);
      }
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void act(gameId ? { type: 'join', name } : { type: 'create', kind, name, capacity });
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    else { setError(''); setNotice(''); }
    setBusy(false);
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(location.href); setNotice('Invite link copied.'); }
    catch { setNotice(`Share this link: ${location.href}`); }
  }

  return {
    userId, email, setEmail, password, setPassword, gameId, lobby, game, recent,
    name, setName, kind, setKind, capacity, setCapacity, busy, loading, error, notice,
    navigate, act, submit, signIn, signOut, copyInvite,
  };
}

export type GameLifecycle = ReturnType<typeof useGameLifecycle>;
