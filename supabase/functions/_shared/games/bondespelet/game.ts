import { actingPlayerIndex, playerColors, startingMoney } from './types.ts';
import type { Action, Game } from './types.ts';
import { endGame, leaveGame } from './lifecycle.ts';
import { joinGame, rollForTurnOrder, selectCroft, setPlayerColor, startGame } from './setup.ts';
import { playTurn } from './gameplay.ts';
import { plantDuringPreparation } from './planting.ts';
import { changeBuilding } from './buildings.ts';

export * from './types.ts';
export { createGame } from './lifecycle.ts';

// Only the Edge Function runs this reducer. Clients send intentions, never state.
export function applyAction(game: Game, playerId: string, action: Action): Game {
  const next = structuredClone(game);
  if (next.initialPlanting) {
    next.plantingOrder ??= next.initialPlanting;
    delete next.initialPlanting;
  }
  next.players.forEach((p, i) => { p.color ??= playerColors[i]; p.money ??= startingMoney; });
  if (action.type === 'join') {
    joinGame(next, playerId, action.name, action.color);
    return next;
  }
  const playerIndex = next.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error('Join this game first.');
  const turnPlayerIndex = actingPlayerIndex(next, playerId);
  switch (action.type) {
    case 'set-debug':
      if (playerIndex !== 0) throw new Error('Only the host can change debug mode.');
      if (typeof action.enabled !== 'boolean') throw new Error('Choose whether debug mode is enabled.');
      next.debug = action.enabled;
      break;
    case 'end':
      endGame(next, playerIndex);
      break;
    case 'leave':
      leaveGame(next, playerIndex);
      break;
    case 'set-color':
      setPlayerColor(next, playerIndex, action.color);
      break;
    case 'select-croft':
      selectCroft(next, turnPlayerIndex, action.croftId);
      break;
    case 'change-building':
      changeBuilding(next, turnPlayerIndex, action.buildingId);
      break;
    case 'start':
      startGame(next, playerIndex);
      break;
    case 'roll':
      if (!next.turnOrder) rollForTurnOrder(next, turnPlayerIndex);
      else playTurn(next, turnPlayerIndex, action);
      break;
    case 'end-turn':
    case 'harvest':
      playTurn(next, turnPlayerIndex, action);
      break;
    case 'plant':
    case 'return-crop':
    case 'confirm-planting':
      plantDuringPreparation(next, turnPlayerIndex, action);
      break;
    default:
      throw new Error('Unknown action.');
  }
  return next;
}
