import type { Game, PlayerColor } from './types.ts';
import { startingMoney } from './types.ts';
import { advanceRolls, playerColor, playerName } from './setup.ts';
import { advancePlanting } from './planting.ts';
import { advanceTurn } from './gameplay.ts';

export function createGame(playerId: string, name: string, capacity: number, color: PlayerColor = 'black'): Game {
  if (![2, 3, 4].includes(capacity)) throw new Error('Choose 2–4 players.');
  return {
    kind: 'bondespelet', status: 'waiting', capacity, year: 1,
    players: [{ id: playerId, name: playerName(name), score: 0, money: startingMoney, color: playerColor(color), position: 0 }],
    currentPlayer: 0,
    fields: Array.from({ length: 12 }, (_, id) => ({
      id, value: [2, 1, 3, 2, 3, 2, 1, 3, 1, 3, 2, 1][id], owner: null,
    })),
    lastMove: 'The farm is open. Invite your friends!',
  };
}

export function endGame(game: Game, playerIndex: number) {
  if (playerIndex !== 0) throw new Error('Only the host can end the game.');
  if (game.status !== 'waiting') throw new Error('Only waiting games can be ended.');
  game.status = 'finished';
  game.lastMove = 'The host ended the game before it started.';
}

export function leaveGame(game: Game, playerIndex: number) {
  const playerId = game.players[playerIndex].id;
  const wasCurrent = playerIndex === game.currentPlayer;
  const followingId = game.turnOrder?.[(game.turnOrder.indexOf(playerId) + 1) % game.turnOrder.length];
  const [player] = game.players.splice(playerIndex, 1);
  if (game.turnOrder) game.turnOrder = game.turnOrder.filter((id) => id !== playerId);
  if (game.finishOrder) game.finishOrder = game.finishOrder.filter((id) => id !== playerId);
  for (const field of game.fields) {
    if (field.owner === playerId) field.owner = null;
  }
  if (playerIndex < game.currentPlayer) game.currentPlayer--;
  game.currentPlayer %= game.players.length || 1;
  if (wasCurrent && game.turnOrder?.length) game.currentPlayer = game.players.findIndex((p) => p.id === followingId);
  if (wasCurrent) delete game.turnRoll;
  if (!game.players.length || (game.status === 'playing' && game.players.length < 2)) game.status = 'finished';
  game.lastMove = `${player.name} left the farm.`;
  if (game.status === 'playing') {
    if (!game.turnOrder) advanceRolls(game);
    else if (game.plantingOrder) {
      game.plantingOrder = game.plantingOrder.filter((id) => id !== playerId);
      advancePlanting(game);
    } else if (game.finishOrder?.length === game.players.length ||
      (game.turnRoll === undefined && game.finishOrder?.includes(game.players[game.currentPlayer].id))) advanceTurn(game);
  }
}
