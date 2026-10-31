import { boardSpaceCount, playerHarvestValue, startingMoney } from './types.ts';
import type { Action, Game } from './types.ts';

export function playTurn(game: Game, playerIndex: number, action: Extract<Action, { type: 'roll' | 'end-turn' | 'harvest' }>) {
  const playerId = game.players[playerIndex].id;
  if (game.status !== 'playing') throw new Error('The game is not in progress.');
  if (game.turnOrder && game.players.some((p) => p.croft === undefined)) {
    throw new Error('Every player must choose a croft before playing turns.');
  }
  if (game.plantingOrder) throw new Error('Every player must plant crops and confirm planting before playing turns.');
  if (action.type === 'roll') {
    const player = game.players[playerIndex];
    if (playerIndex !== game.currentPlayer) throw new Error('It is not your turn.');
    if (game.turnRoll !== undefined) throw new Error('You have already rolled this turn.');
    if (game.finishOrder?.includes(playerId)) throw new Error('You have finished this year.');
    game.turnRoll = Math.floor(Math.random() * 6) + 1;
    player.position = Math.min((player.position ?? 0) + game.turnRoll, boardSpaceCount + 1);
    game.lastMove = `${player.name} rolled ${game.turnRoll} and moved to space ${player.position}.`;
    if (player.position >= 82 && player.crops?.length) {
      player.crops = [];
      delete player.pendingCrops;
      game.lastMove += ' Unharvested crops returned to the stacks without payment.';
    }
    if (player.position > boardSpaceCount) {
      (game.finishOrder ??= []).push(playerId);
      game.lastMove += ` Finished the year in place ${game.finishOrder.length}.`;
    }
    return;
  }
  if (game.players.some((p) => p.roll === undefined)) throw new Error('Every player must roll before ending a turn.');
  if (playerIndex !== game.currentPlayer) throw new Error('It is not your turn.');
  if (game.turnRoll === undefined) throw new Error('Roll the die to move before continuing your turn.');
  if (action.type === 'harvest') {
    const player = game.players[playerIndex];
    if ((player.position ?? 0) < 55 || (player.position ?? 0) > 81) throw new Error('You can only harvest on spaces 55–81.');
    if (!player.crops?.length) throw new Error('You have no crops to harvest.');
    const income = playerHarvestValue(player);
    player.money = (player.money ?? startingMoney) + income;
    player.crops = [];
    delete player.pendingCrops;
    game.lastMove = `${player.name} harvested all their crops for ${income.toLocaleString('sv-SE')} kr.`;
    return;
  }
  game.lastMove = `${game.players[playerIndex].name} ended their turn.`;
  advanceTurn(game);
}

export function advanceTurn(game: Game) {
  delete game.turnRoll;
  if (game.finishOrder?.length === game.players.length) {
    game.turnOrder = [...game.finishOrder];
    game.plantingOrder = [...game.finishOrder];
    game.year = (game.year ?? 1) + 1;
    delete game.finishOrder;
    for (const player of game.players) {
      player.position = 0;
      player.crops = [];
      delete player.pendingCrops;
    }
    game.currentPlayer = game.players.findIndex((p) => p.id === game.turnOrder![0]);
    game.lastMove += ` The year has ended. Change buildings and plant fields for year ${game.year} in finish order. ${game.players[game.currentPlayer].name} prepares first.`;
    return;
  }
  const order = game.turnOrder!;
  const current = order.indexOf(game.players[game.currentPlayer].id);
  const nextId = [...order.slice(current + 1), ...order.slice(0, current + 1)]
    .find((id) => !game.finishOrder?.includes(id));
  game.currentPlayer = game.players.findIndex((p) => p.id === nextId);
  game.lastMove += ` ${game.players[game.currentPlayer].name} rolls next.`;
}
