import { cropPlantingCost, crops, cropsPerStack, playerFieldCount, startingMoney } from './types.ts';
import type { Action, Game } from './types.ts';

export type PlantingAction = Extract<Action, { type: 'plant' | 'return-crop' | 'confirm-planting' }>;

export function plantFields(game: Game, playerIndex: number, action: PlantingAction) {
  const player = game.players[playerIndex];
  const cost = cropPlantingCost(player, game.year);
  if (action.type === 'return-crop') {
    const count = player.crops?.length ?? 0;
    if (!Number.isInteger(action.fieldIndex) || action.fieldIndex < count - (player.pendingCrops ?? 0) || action.fieldIndex >= count) {
      throw new Error('Choose an unconfirmed crop in your fields.');
    }
    const [cropId] = player.crops!.splice(action.fieldIndex, 1);
    player.pendingCrops = (player.pendingCrops ?? 0) - 1;
    if (!player.pendingCrops) delete player.pendingCrops;
    if (cost) player.money = (player.money ?? startingMoney) + cost;
    game.lastMove = `${player.name} returned ${crops.find((crop) => crop.id === cropId)!.name.toLowerCase()} to the stack.`;
    return;
  }
  if (action.type === 'confirm-planting') {
    if (!player.pendingCrops && !(cost > 0 && !player.crops?.length && (player.money ?? startingMoney) < cost)) {
      throw new Error('No planting to confirm.');
    }
    delete player.pendingCrops;
    game.lastMove = `${player.name} confirmed their planting.`;
    return;
  }
  const crop = crops.find(({ id }) => id === action.crop);
  if (!crop) throw new Error('Choose a valid crop.');
  const planted = game.players.reduce((count, player) => count + (player.crops ?? []).filter((id) => id === crop.id).length, 0);
  if (planted >= cropsPerStack) throw new Error('This crop stack is empty.');
  if ((player.crops?.length ?? 0) >= playerFieldCount(player)) throw new Error('All your fields are already planted.');
  if ((player.money ?? startingMoney) < cost) throw new Error(`You need ${cost.toLocaleString('sv-SE')} kr to plant a crop.`);
  if (cost) player.money = (player.money ?? startingMoney) - cost;
  (player.crops ??= []).push(crop.id);
  player.pendingCrops = (player.pendingCrops ?? 0) + 1;
  game.lastMove = `${player.name} planted ${crop.name.toLowerCase()}.`;
}

export function advancePlanting(game: Game) {
  const nextId = game.plantingOrder![0];
  game.currentPlayer = game.players.findIndex((p) => p.id === (nextId ?? game.turnOrder![0]));
  if (nextId) game.lastMove += game.players[game.currentPlayer].croft === undefined
    ? ` ${game.players[game.currentPlayer].name} chooses a croft next.`
    : ` ${game.players[game.currentPlayer].name} ${(game.year ?? 1) > 1 ? 'prepares' : 'plants'} next.`;
  else {
    delete game.plantingOrder;
    game.lastMove += ` Preparation is complete. ${game.players[game.currentPlayer].name} rolls first.`;
  }
}

export function plantDuringPreparation(game: Game, playerIndex: number, action: PlantingAction) {
  if (game.status !== 'playing') throw new Error('The game is not in progress.');
  if (!game.turnOrder) throw new Error('Every player must roll before planting.');
  if (playerIndex !== game.currentPlayer) throw new Error('It is not your turn.');
  if (game.players[playerIndex].croft === undefined) throw new Error('You must choose a croft before planting.');
  if (!game.plantingOrder) throw new Error('Planting is only allowed during preparation.');
  plantFields(game, playerIndex, action);
  if (action.type === 'confirm-planting') {
    game.plantingOrder.shift();
    advancePlanting(game);
  }
}
