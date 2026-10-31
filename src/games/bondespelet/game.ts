import { useState } from 'react';
import { actingPlayerIndex, crofts } from '../../../supabase/functions/_shared/games/bondespelet/game.ts';
import type { Game } from '../../../supabase/functions/_shared/games/bondespelet/game.ts';
import type { GameLifecycle } from '../../lifecycle.ts';

export function useGame(session: GameLifecycle, state: Game) {
  const { userId, lobby, busy } = session;
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const sidebarPlayers = state?.turnOrder?.map((id) => state.players.find((p) => p.id === id)!) ?? state?.players ?? [];
  const playerIndex = state?.players.findIndex((p) => p.id === userId) ?? -1;
  const showLobby = !state || state.status === 'waiting' || lobby;
  const current = state?.players[state.currentPlayer];
  const ownPlayer = state?.players[playerIndex];
  const controlledPlayer = state?.players[actingPlayerIndex(state, userId)];
  const isTurn = !!current && current.id === controlledPlayer?.id;
  const rolling = state && !state.turnOrder;
  const choosingCrofts = state?.status === 'playing' && !rolling && current?.croft === undefined;
  const canChooseCroft = choosingCrofts && isTurn && controlledPlayer?.croft === undefined && !busy;
  const selectedCroft = crofts.find(({ id }) => id === selectedRegion && !state?.players.some((p) => p.croft === id));
  const planting = state?.status === 'playing' && !!(state.plantingOrder ?? state.initialPlanting) && !choosingCrofts;
  const canPlant = planting && isTurn && !busy;
  const canChangeBuilding = canPlant && (state.year ?? 1) > 1 && !controlledPlayer?.crops?.length;
  const canPlay = state?.status === 'playing' && !rolling && !choosingCrofts && !planting && isTurn && !busy;
  const canRoll = state?.status === 'playing' && !choosingCrofts && !planting && playerIndex !== -1 && !busy &&
    (rolling ? controlledPlayer?.roll === undefined : canPlay && state.turnRoll === undefined);
  const winners = state?.winner ? [state.winner.name] : state?.status === 'finished' && state.fields.some((f) => f.owner !== null)
    ? state.players.filter((p) => p.score === Math.max(...state.players.map((p) => p.score))).map((p) => p.name)
    : [];
  const title = !state ? 'A little farm. A friendly rivalry.'
    : state.status === 'waiting' ? 'Good things grow together.'
    : state.status === 'finished' ? winners.length ? `${winners.join(' & ')} ${winners.length > 1 ? 'share the win!' : 'wins!'}` : 'This game has ended.'
    : choosingCrofts ? isTurn ? 'Your turn. Choose a croft.' : `${current?.name} is choosing a croft.`
    : rolling ? controlledPlayer && controlledPlayer.roll === undefined ? 'Roll the die to decide turn order.' : 'Waiting for opening rolls.'
    : planting ? isTurn ? (state.year ?? 1) > 1 ? 'Change your building or plant crops, then confirm planting.' : 'Prepare your fields. Plant crops and confirm planting.' : `${current?.name} is preparing for the year.`
    : isTurn ? state.turnRoll === undefined ? 'Your turn. Roll the die to move.' : 'Your marker has moved. Finish your turn.'
    : `${current?.name} is taking their turn.`;
  return {
    ...session, state, selectedRegion, setSelectedRegion, sidebarPlayers, playerIndex, showLobby, current, ownPlayer,
    rolling, choosingCrofts, canChooseCroft, selectedCroft, planting, canPlant, canChangeBuilding, canPlay, canRoll, controlledPlayer, title,
  };
}

export type GameSession = ReturnType<typeof useGame>;
