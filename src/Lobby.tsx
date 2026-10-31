import type { ReactNode } from 'react';
import { gameCatalog } from '../supabase/functions/_shared/catalog.ts';
import type { GameKind } from '../supabase/functions/_shared/catalog.ts';
import { supabase } from './api.ts';
import type { GameLifecycle } from './lifecycle.ts';

export function Lobby({ session, rules }: { session: GameLifecycle; rules?: ReactNode }) {
  const {
    game, gameId, loading, userId, email, setEmail, password, setPassword, busy, signIn, copyInvite, act,
    navigate, submit, name, setName, kind, setKind, capacity, setCapacity, error, notice, signOut, recent,
  } = session;
  const state = game?.state;
  const definition = gameCatalog[state ? state.kind ?? 'bondespelet' : kind];
  return (
    <div className="lobby-layout">
      <div className="lobby-games">
        <section className="card">
          <p className="eyebrow">{state ? definition.name : gameId ? 'YOU’RE INVITED' : 'COME ON IN'}</p>
          <h2>{supabase && !loading && !userId ? 'Sign in' : state ? 'Your players' : gameId ? 'Join a game' : 'Start a new game'}</h2>
          {!supabase ? <div className="setup"><p>Connect Supabase to play.</p><p>Copy <code>.env.example</code> to <code>.env</code>, add your project URL and public key, then restart the app. Setup instructions are in the README.</p></div>
            : loading ? <p role="status">Opening the game…</p>
            : !userId ? <form onSubmit={(event) => { void signIn(event); }}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
              <p className="hint">Private games for friends. Ask the host for an account.</p>
            </form>
            : state ? <>
              <ol className="players">{state.players.map((p) => <li key={p.id}>
                <span className="avatar">{p.name.charAt(0).toUpperCase()}</span>
                <span className="player-name">{p.name}{p.id === userId && <small>you</small>}{p.id === state.players[0]?.id && <small>host</small>}</span>
              </li>)}
              {state.status === 'waiting' && Array.from({ length: state.capacity - state.players.length }, (_, i) => <li className="empty-seat" key={i}><span className="avatar">+</span>Waiting for a friend</li>)}</ol>
              {state.status === 'waiting' && <>
                <button className="secondary" onClick={() => { void copyInvite(); }}>Copy invite link ↗</button>
                {state.players[0]?.id === userId ? <>
                  <button disabled={busy || state.players.length < 2} onClick={() => { void act({ type: 'start' }); }}>{state.players.length < 2 ? 'Start game' : `Start with ${state.players.length} players`}</button>
                  <button className="text-button" disabled={busy} onClick={() => {
                    if (window.confirm('End this game for everyone? No one will be able to join or start it.')) void act({ type: 'end' });
                  }}>End game</button>
                </> : <p className="hint">Your host will start the game.</p>}
                <p className="hint">{state.capacity === 2 ? 'Two players are needed.' : `Start with 2–${state.capacity} players without filling every seat.`} Joining closes when the game begins.</p>
              </>}
              {state.status === 'playing' && <><p>Your game is saved. Open it to continue playing.</p><button onClick={() => navigate(gameId)}>Open game</button></>}
              {state.status === 'finished' && <button onClick={() => navigate('')}>Start another game</button>}
            </> : <form onSubmit={submit}>
              {!gameId && <>
                <label htmlFor="game-kind">Game</label>
                <select id="game-kind" value={kind} onChange={(e) => { setKind(e.target.value as GameKind); setCapacity(2); }}>
                  {Object.entries(gameCatalog).map(([id, game]) => <option key={id} value={id}>{game.name}</option>)}
                </select>
                <p>{definition.description}</p>
              </>}
              <label htmlFor="name">Your name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={24} placeholder="e.g. Astrid" autoComplete="nickname" />
              {!gameId && <><label htmlFor="capacity">Seats at the table</label><select id="capacity" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>{definition.capacities.map((seats) => <option key={seats} value={seats}>{seats} players</option>)}</select></>}
              <button disabled={busy || !userId || !name.trim()}>{busy ? 'Opening…' : gameId ? 'Join game' : 'Create game →'}</button>
              <p className="hint">Up to 5 unfinished games across the group. Your games follow your account on any device.</p>
            </form>}
          {error && <p className="message error" role="alert">{error}</p>}
          {notice && <p className="message" role="status">{notice}</p>}
          {gameId && <button className="text-button" onClick={() => navigate('')}>← All your games</button>}
          {userId && <button className="text-button" disabled={busy} onClick={() => { void signOut(); }}>Sign out</button>}
        </section>
        {!gameId && recent.length > 0 && <section className="card"><h2>Your games</h2><div className="recent-games">{recent.map((row) => <button className="secondary" key={row.id} onClick={() => navigate(row.id)}>{gameCatalog[row.state.kind ?? 'bondespelet'].name}<small>{row.state.players.map((p) => p.name).join(', ')} · {row.state.status}</small></button>)}</div></section>}
      </div>
      {rules}
    </div>
  );
}
