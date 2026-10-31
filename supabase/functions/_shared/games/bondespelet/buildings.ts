import { buildingPrices, buildings, startingMoney } from './types.ts';
import type { Game } from './types.ts';

export function changeBuilding(game: Game, playerIndex: number, buildingId: number) {
  if (game.status !== 'playing' || (game.year ?? 1) <= 1 || !game.plantingOrder) {
    throw new Error('Buildings can only be changed at a year shift.');
  }
  if (playerIndex !== game.currentPlayer) throw new Error('It is not your turn.');
  const player = game.players[playerIndex];
  if (player.croft === undefined) throw new Error('Choose a croft first.');
  if (player.crops?.length) throw new Error('Change your building before planting crops.');
  const building = buildings.find(({ id }) => id === buildingId);
  if (!building) throw new Error('Choose a valid building.');
  if (building.id === player.croft) throw new Error('You already own this building.');
  if (game.players.some((other) => other.id !== player.id && other.croft === building.id)) {
    throw new Error('This building is already taken.');
  }
  const salePrice = buildingPrices[player.buildingType ?? 'croft'];
  const purchasePrice = buildingPrices[building.type];
  const balance = (player.money ?? startingMoney) + salePrice;
  if (balance < purchasePrice) throw new Error(`You need ${purchasePrice.toLocaleString('sv-SE')} kr to buy this building.`);
  player.money = balance - purchasePrice;
  player.croft = building.id;
  player.buildingType = building.type;
  game.lastMove = `${player.name} sold their ${salePrice.toLocaleString('sv-SE')} kr building and bought ${building.name} for ${purchasePrice.toLocaleString('sv-SE')} kr.`;
  if (building.type === 'castle') {
    game.status = 'finished';
    game.winner = { id: player.id, name: player.name };
    game.lastMove += ` ${player.name} wins!`;
  }
}
