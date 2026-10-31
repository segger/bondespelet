import { crofts, playerColors, startingMoney } from './types.ts';
import type { Game, Player, PlayerColor } from './types.ts';
import { playerName } from '../../catalog.ts';

export { playerName } from '../../catalog.ts';

export function playerColor(color: unknown, players: Player[] = [], playerId?: string): PlayerColor {
  if (!playerColors.includes(color as PlayerColor)) throw new Error('Choose black, red, green, blue, yellow or white.');
  if (players.some((p, i) => p.id !== playerId && (p.color ?? playerColors[i]) === color)) {
    throw new Error('This color is already taken. Choose another color.');
  }
  return color as PlayerColor;
}

function compareRolls(a: Player, b: Player): number {
  const left = a.rolls ?? [a.roll!];
  const right = b.rolls ?? [b.roll!];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (right[i] ?? 0) - (left[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

export function advanceRolls(game: Game) {
  if (game.players.every((p) => p.roll !== undefined)) {
    const ordered = [...game.players].sort(compareRolls);
    const tied = ordered.filter((p, i) =>
      (i > 0 && compareRolls(p, ordered[i - 1]) === 0) ||
      (i + 1 < ordered.length && compareRolls(p, ordered[i + 1]) === 0));
    if (!tied.length) {
      game.turnOrder = ordered.map((p) => p.id);
      game.currentPlayer = game.players.indexOf(ordered[0]);
      game.lastMove += ` ${ordered[0].name} goes first. Choose a croft in turn order.`;
      return;
    }
    for (const player of tied) {
      player.rolls ??= [player.roll!];
      delete player.roll;
    }
    game.lastMove += ' Tied players must roll again.';
  }
}

export function joinGame(game: Game, playerId: string, name: string, color?: PlayerColor) {
  if (game.players.some((p) => p.id === playerId)) return;
  if (game.status !== 'waiting') throw new Error('This game has already started.');
  if (game.players.length >= game.capacity) throw new Error('This game is full.');
  name = playerName(name);
  color = playerColor(color ?? playerColors.find((color) =>
    !game.players.some((p, i) => (p.color ?? playerColors[i]) === color)), game.players);
  game.players.push({ id: playerId, name, score: 0, money: startingMoney, color, position: 0 });
  game.lastMove = `${name} joined the farm.`;
}

export function setPlayerColor(game: Game, playerIndex: number, color: PlayerColor) {
  const player = game.players[playerIndex];
  player.color = playerColor(color, game.players, player.id);
}

export function selectCroft(game: Game, playerIndex: number, croftId: number) {
  if (game.status !== 'playing' || !game.turnOrder) throw new Error('Decide turn order before choosing crofts.');
  const player = game.players[playerIndex];
  if (player.croft !== undefined) throw new Error('You have already chosen a croft.');
  if (playerIndex !== game.currentPlayer) throw new Error('It is not your turn to choose a croft.');
  const croft = crofts.find((croft) => croft.id === croftId);
  if (!croft) throw new Error('Choose a valid croft.');
  if (game.players.some((p, i) => i !== playerIndex && p.croft === croftId)) {
    throw new Error('This croft is already taken. Choose another croft.');
  }
  player.croft = croftId;
  player.buildingType = 'croft';
  game.plantingOrder ??= [...game.turnOrder];
  game.lastMove = `${player.name} chose ${croft.name}. Plant crops and confirm planting before the next player chooses a croft.`;
}

export function startGame(game: Game, playerIndex: number) {
  if (playerIndex !== 0) throw new Error('Only the host can start the game.');
  if (game.status !== 'waiting') throw new Error('This game has already started.');
  if (game.players.length < 2) throw new Error('At least two players are needed.');
  game.status = 'playing';
  game.lastMove = 'Each player must roll a six-sided die to decide turn order.';
}

export function rollForTurnOrder(game: Game, playerIndex: number) {
  if (game.status !== 'playing') throw new Error('The game is not in progress.');
  const player = game.players[playerIndex];
  if (player.roll !== undefined) throw new Error('You have already rolled.');
  player.roll = Math.floor(Math.random() * 6) + 1;
  player.rolls = [...(player.rolls ?? []), player.roll];
  game.lastMove = `${player.name} rolled ${player.roll}.`;
  advanceRolls(game);
}
