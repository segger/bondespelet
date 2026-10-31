import type { GameBase, GameKind } from '../../catalog.ts';

export const playerColors = ['black', 'red', 'green', 'blue', 'yellow', 'white'] as const;
export type PlayerColor = typeof playerColors[number];
export const boardSpaceCount = 108;
export const startingMoney = 10_000;
export const crops = [
  { id: 'wheat', name: 'Wheat', color: '#d6aa42' },
  { id: 'rye', name: 'Rye', color: '#b89a63' },
  { id: 'barley', name: 'Barley', color: '#c98a38' },
  { id: 'oats', name: 'Oats', color: '#b9b66a' },
  { id: 'potatoes', name: 'Potatoes', color: '#a97e5b' },
  { id: 'sugar-beets', name: 'Sugar beets', color: '#a6b98b' },
] as const;
export type Crop = typeof crops[number]['id'];
export const cropsPerStack = 12;
export const fieldsPerBuilding = { croft: 3, farm: 3, mansion: 5, castle: 0 } as const;
export const cropCostPerBuilding = { croft: 1_000, farm: 3_000, mansion: 10_000, castle: 0 } as const;
export const harvestPerBuilding = { croft: 10_000, farm: 30_000, mansion: 100_000, castle: 0 } as const;
export type BuildingType = keyof typeof fieldsPerBuilding;
export const buildingPrices = { croft: 50_000, farm: 200_000, mansion: 750_000, castle: 2_500_000 } as const;
export const crofts = [
  { id: 13, name: 'Björkebo' }, { id: 15, name: 'Granstugan' }, { id: 20, name: 'Backstugan' },
  { id: 1, name: 'Ängslyckan' }, { id: 7, name: 'Sjöbacken' }, { id: 8, name: 'Lilltorpet' },
];
export const buildings: { id: number; name: string; type: BuildingType }[] = [
  ...crofts.map((croft) => ({ ...croft, type: 'croft' as const })),
  { id: 11, name: 'Björkbacka', type: 'farm' }, { id: 0, name: 'Solåkra', type: 'farm' },
  { id: 2, name: 'Ängsby', type: 'farm' }, { id: 9, name: 'Norrgården', type: 'farm' },
  { id: 6, name: 'Lövsta', type: 'mansion' }, { id: 4, name: 'Björkvik', type: 'mansion' },
  { id: 3, name: 'Gyllenborg', type: 'castle' },
];
export type Player = { id: string; name: string; score: number; money?: number; color?: PlayerColor; croft?: number; buildingType?: BuildingType; crops?: Crop[]; pendingCrops?: number; roll?: number; rolls?: number[]; position?: number };
export function playerFieldCount(player?: Player): number {
  return player?.croft === undefined ? 0 : fieldsPerBuilding[player.buildingType ?? 'croft'];
}
export function cropPlantingCost(player?: Player, year = 1): number {
  return year <= 1 || player?.croft === undefined ? 0 : cropCostPerBuilding[player.buildingType ?? 'croft'];
}
export function playerHarvestValue(player?: Player): number {
  return (player?.crops?.length ?? 0) * harvestPerBuilding[player?.buildingType ?? 'croft'];
}
export type Field = { id: number; value: number; owner: string | null };
export type Game = GameBase<Player> & {
  kind?: 'bondespelet'; // Older saved games have no kind.
  debug?: boolean;
  turnOrder?: string[];
  plantingOrder?: string[];
  initialPlanting?: string[]; // Older saved games.
  year?: number;
  finishOrder?: string[];
  turnRoll?: number;
  fields: Field[];
};
export type GameRow<State = Game> = { id: string; version: number; state: State };
export function actingPlayerIndex(game: Game, playerId: string): number {
  const index = game.players.findIndex((p) => p.id === playerId);
  if (!game.debug || index !== 0 || game.status !== 'playing') return index;
  return game.turnOrder ? game.currentPlayer : game.players.findIndex((p) => p.roll === undefined);
}

export type Action =
  | { type: 'create'; kind?: GameKind; name: string; capacity: number; color?: PlayerColor }
  | { type: 'join'; name: string; color?: PlayerColor }
  | { type: 'set-color'; color: PlayerColor }
  | { type: 'set-debug'; enabled: boolean }
  | { type: 'select-croft'; croftId: number }
  | { type: 'change-building'; buildingId: number }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'roll' }
  | { type: 'end-turn' }
  | { type: 'harvest' }
  | { type: 'plant'; crop: Crop }
  | { type: 'return-crop'; fieldIndex: number }
  | { type: 'confirm-planting' }
  | { type: 'end' };
