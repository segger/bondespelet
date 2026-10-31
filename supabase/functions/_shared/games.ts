import { applyAction as applyBondespeletAction, createGame as createBondespelet } from './games/bondespelet/game.ts';
import type { Action as BondespeletAction, Game, GameRow as SavedGame } from './games/bondespelet/types.ts';
import { applyAction as applyTicTacToeAction, createGame as createTicTacToe } from './games/tic-tac-toe/game.ts';
import type { TicTacToe, TicTacToeAction } from './games/tic-tac-toe/game.ts';

export type GameState = Game | TicTacToe;
export type GameRow = SavedGame<GameState>;
export type Action = BondespeletAction | TicTacToeAction;

export function createGame(playerId: string, action: Extract<Action, { type: 'create' }>): GameState {
  switch (action.kind) {
    case undefined:
    case 'bondespelet':
      return createBondespelet(playerId, action.name, action.capacity, action.color);
    case 'tic-tac-toe':
      return createTicTacToe(playerId, action.name, action.capacity);
    default:
      throw new Error('Unknown game type.');
  }
}

export function applyAction(game: GameState, playerId: string, action: Action): GameState {
  switch (game.kind) {
    case undefined:
    case 'bondespelet':
      if (action.type === 'mark') throw new Error('Unknown Bondespelet action.');
      return applyBondespeletAction(game, playerId, action);
    case 'tic-tac-toe':
      switch (action.type) {
        case 'join':
        case 'start':
        case 'end':
        case 'leave':
        case 'mark':
          return applyTicTacToeAction(game, playerId, action);
        default:
          throw new Error('Unknown tic-tac-toe action.');
      }
    default:
      throw new Error('Unknown game type.');
  }
}
