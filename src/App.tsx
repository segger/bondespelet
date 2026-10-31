import { gameCatalog } from '../supabase/functions/_shared/catalog.ts';
import { Bondespelet } from './games/bondespelet/Bondespelet.tsx';
import { Lobby } from './Lobby.tsx';
import { useGameLifecycle } from './lifecycle.ts';
import { BondespeletRules } from './games/bondespelet/setup.tsx';
import { TicTacToe, TicTacToeRules } from './games/tic-tac-toe/TicTacToe.tsx';

export default function App() {
  const session = useGameLifecycle();
  const { game, gameId, lobby, kind, navigate, userId, busy, act } = session;
  const state = game?.state;
  const showLobby = !state || state.status === 'waiting' || lobby;
  const definition = gameCatalog[state ? state.kind ?? 'bondespelet' : kind];
  return (
    <div className="app">
      <header>
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate(''); }}>
          <span className="brand-icon" aria-hidden="true">✳</span> Game lobby
        </a>
        <div className="header-actions">
          {state && state.status !== 'waiting' && <a className="page-link" href={`?game=${gameId}${showLobby ? '' : '&lobby'}`} onClick={(event) => { event.preventDefault(); navigate(gameId, !showLobby); }}>{showLobby ? 'Back to game' : 'Lobby'}</a>}
          <span className="tag">{state ? definition.name : 'Games for friends'}</span>
        </div>
      </header>
      <main>
        {state?.kind === 'tic-tac-toe' ? <TicTacToe key={gameId} session={session} state={state} />
          : state ? <Bondespelet key={gameId} session={session} state={state} />
          : <>
            <div className="intro"><p className="eyebrow">LOBBY</p><h1>{gameId ? 'A place at the table.' : 'Choose a game. Invite your friends.'}</h1></div>
            <Lobby session={session} rules={gameId ? undefined : kind === 'tic-tac-toe' ? <TicTacToeRules /> : <BondespeletRules />} />
          </>}
        {state?.players.some((p) => p.id === userId) && <button className="text-button" disabled={busy} onClick={() => {
          if (window.confirm('Leave this game? If you host, hosting passes to the next player. An active game ends if fewer than two players remain.')) {
            void act({ type: 'leave' });
          }
        }}>Leave game</button>}
      </main>
      <footer>Made by Jojo.<span>Just for fun</span></footer>
    </div>
  );
}
