import type { Game } from '../../../supabase/functions/_shared/games/bondespelet/game.ts';
import { useGame } from './game.ts';
import { GamePlay } from './gameplay.tsx';
import { Lobby } from '../../Lobby.tsx';
import type { GameLifecycle } from '../../lifecycle.ts';
import { BondespeletRules } from './setup.tsx';

export function Bondespelet({ session: lifecycle, state }: { session: GameLifecycle; state: Game }) {
  const session = useGame(lifecycle, state);
  const { showLobby, title, playerIndex, busy, act, controlledPlayer } = session;
  return <>
    <div className="intro"><p className="eyebrow">{showLobby ? 'LOBBY' : 'NYA BONDESPELET'}</p><h1>{title}</h1>
      {state.status !== 'finished' && playerIndex === 0 && <button type="button" className="text-button" disabled={busy}
        aria-pressed={!!state.debug} onClick={() => { void act({ type: 'set-debug', enabled: !state.debug }); }}>Debug mode: {state.debug ? 'on' : 'off'}</button>}
      {state.debug && <p role="status">{playerIndex === 0 && controlledPlayer
        ? `Debug mode: playing as ${controlledPlayer.name}.`
        : 'Debug mode: the host can take other players’ turns.'}</p>}
    </div>
    {showLobby ? <Lobby session={lifecycle} rules={<BondespeletRules />} /> : <GamePlay session={session} />}
  </>;
}
