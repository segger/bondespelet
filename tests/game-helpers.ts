import { mock } from 'node:test';
import { applyAction, createGame, crofts } from '../supabase/functions/_shared/games/bondespelet/game.ts';
import type { Game } from '../supabase/functions/_shared/games/bondespelet/game.ts';

export function roll(game: Game, face: number, playerId = game.players.find((p) => p.roll === undefined)!.id) {
  const random = mock.method(Math, 'random', () => (face - 0.5) / 6);
  try { return applyAction(game, playerId, { type: 'roll' }); }
  finally { random.mock.restore(); }
}

export function endTurn(game: Game, playerId: string) {
  return applyAction(roll(game, 1, playerId), playerId, { type: 'end-turn' });
}

export function chooseCroft(game: Game) {
  const player = game.players[game.currentPlayer];
  if (player.croft !== undefined) return game;
  const croft = crofts.find((croft) => !game.players.some((p) => p.croft === croft.id))!;
  return applyAction(game, player.id, { type: 'select-croft', croftId: croft.id });
}

export function chooseCrofts(game: Game, autoPlant = true) {
  while (game.players.some((p) => p.croft === undefined) || game.plantingOrder) {
    game = chooseCroft(game);
    if (!autoPlant) break;
    const id = game.players[game.currentPlayer].id;
    game = applyAction(game, id, { type: 'plant', crop: 'wheat' });
    game = applyAction(game, id, { type: 'confirm-planting' });
  }
  return game;
}

export function playing(count = 2, autoRoll = true, autoPlant = true) {
  let game = createGame('p0', 'Astrid', count);
  for (let i = 1; i < count; i++) game = applyAction(game, `p${i}`, { type: 'join', name: `Farmer ${i}` });
  game = applyAction(game, 'p0', { type: 'start' });
  if (autoRoll) {
    for (let i = 0; i < count; i++) game = roll(game, 6 - i);
    game = chooseCrofts(game, autoPlant);
  }
  return game;
}
