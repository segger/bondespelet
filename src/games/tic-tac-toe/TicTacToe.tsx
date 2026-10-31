import type { TicTacToe as TicTacToeState } from '../../../supabase/functions/_shared/games/tic-tac-toe/game.ts';
import { Lobby } from '../../Lobby.tsx';
import type { GameLifecycle } from '../../lifecycle.ts';

export function TicTacToeRules() {
  return <section className="rules"><p className="eyebrow">THREE IN A ROW</p><h2>How to play</h2>
    <p>Invite a friend, then start the game. The host plays X and goes first; the other player plays O. Take turns choosing an empty square. Three matching marks in a row, column, or diagonal wins. If all nine squares fill without a winner, the game is a draw.</p>
    <p>Your progress is saved after every move. Return whenever you are ready.</p>
  </section>;
}

export function TicTacToe({ session, state }: { session: GameLifecycle; state: TicTacToeState }) {
  const { userId, busy, act, error, lobby, navigate } = session;
  const showLobby = state.status === 'waiting' || lobby;
  const isTurn = state.status === 'playing' && state.players[state.currentPlayer]?.id === userId;
  const title = state.status === 'waiting' ? 'Invite a friend. Play a round.'
    : state.status === 'finished' ? state.winner ? `${state.winner.name} wins!`
      : state.cells.every((cell) => cell !== null) ? 'The game is a draw.' : 'This game has ended.'
    : isTurn ? 'Your turn. Choose a square.' : `${state.players[state.currentPlayer]?.name} is taking their turn.`;
  return <>
    <div className="intro"><p className="eyebrow">{showLobby ? 'LOBBY' : 'TIC-TAC-TOE · SAMPLE GAME'}</p><h1>{title}</h1></div>
    {showLobby ? <Lobby session={session} rules={<TicTacToeRules />} /> : <div className="game-layout">
      <section className="card" aria-label="Tic-tac-toe">
        <div className="tic-tac-toe" role="group" aria-label="Board">
          {state.cells.map((mark, cell) => <button key={cell} type="button" className="secondary"
            aria-label={`Row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}: ${mark ?? 'empty'}`}
            disabled={busy || !isTurn || mark !== null} onClick={() => { void act({ type: 'mark', cell }); }}>{mark ?? '·'}</button>)}
        </div>
        <p role="status">{busy ? 'Saving…' : state.lastMove}</p>
        {error && <p className="message error" role="alert">{error}</p>}
        {state.status === 'finished' && <button onClick={() => navigate('')}>Start another game</button>}
      </section>
      <aside className="game-sidebar">
        <section className="card"><h2>Players</h2><ol className="players">{state.players.map((player, index) => <li key={player.id}
          aria-current={state.status === 'playing' && index === state.currentPlayer ? 'true' : undefined}>
          <span className="avatar">{player.mark}</span><span className="player-name">{player.name}{player.id === userId && <small>you</small>}</span>
        </li>)}</ol></section>
        <TicTacToeRules />
      </aside>
    </div>}
  </>;
}
