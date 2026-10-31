import { playerName } from '../../catalog.ts';
import type { GameBase, LobbyPlayer } from '../../catalog.ts';

export type Mark = 'X' | 'O';
export type TicTacToe = GameBase<LobbyPlayer & { mark: Mark }> & { kind: 'tic-tac-toe'; cells: (Mark | null)[] };
export type TicTacToeAction =
  | { type: 'join'; name: string }
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'leave' }
  | { type: 'mark'; cell: number };

export function createGame(playerId: string, name: string, capacity: number): TicTacToe {
  if (capacity !== 2) throw new Error('Tic-tac-toe needs exactly two players.');
  return {
    kind: 'tic-tac-toe', status: 'waiting', capacity,
    players: [{ id: playerId, name: playerName(name), mark: 'X' }], currentPlayer: 0,
    cells: Array(9).fill(null), lastMove: 'Invite a friend to play tic-tac-toe.',
  };
}

export function applyAction(game: TicTacToe, playerId: string, action: TicTacToeAction): TicTacToe {
  const next = structuredClone(game);
  const playerIndex = next.players.findIndex((p) => p.id === playerId);
  if (action.type === 'join') {
    if (playerIndex !== -1) return next;
    if (next.status !== 'waiting') throw new Error('This game has already started.');
    if (next.players.length >= next.capacity) throw new Error('This game is full.');
    const name = playerName(action.name);
    next.players.push({ id: playerId, name, mark: 'O' });
    next.lastMove = `${name} joined the game.`;
    return next;
  }
  if (playerIndex === -1) throw new Error('Join this game first.');
  const player = next.players[playerIndex];
  switch (action.type) {
    case 'start':
    case 'end':
      if (playerIndex !== 0) throw new Error('Only the host can start or end the game.');
      if (next.status !== 'waiting') throw new Error('This game has already started or ended.');
      if (action.type === 'start' && next.players.length !== 2) throw new Error('Exactly two players are needed.');
      next.status = action.type === 'start' ? 'playing' : 'finished';
      next.lastMove = action.type === 'start' ? `${player.name} plays X and goes first.` : 'The host ended the game before it started.';
      break;
    case 'leave':
      next.players.splice(playerIndex, 1);
      next.currentPlayer = 0;
      if (next.status === 'waiting' && next.players[0]) next.players[0].mark = 'X';
      if (!next.players.length || next.status === 'playing') next.status = 'finished';
      next.lastMove = `${player.name} left the game.`;
      break;
    case 'mark': {
      if (next.status !== 'playing') throw new Error('The game is not in progress.');
      if (playerIndex !== next.currentPlayer) throw new Error('It is not your turn.');
      if (!Number.isInteger(action.cell) || action.cell < 0 || action.cell > 8) throw new Error('Choose a valid square.');
      if (next.cells[action.cell] !== null) throw new Error('This square is already taken.');
      const mark = player.mark;
      next.cells[action.cell] = mark;
      next.lastMove = `${player.name} placed ${mark} in square ${action.cell + 1}.`;
      const won = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
        .some((line) => line.every((cell) => next.cells[cell] === mark));
      if (won) {
        next.status = 'finished';
        next.winner = { id: player.id, name: player.name };
        next.lastMove += ` ${player.name} wins!`;
      } else if (next.cells.every((cell) => cell !== null)) {
        next.status = 'finished';
        next.lastMove += ' The game is a draw.';
      } else next.currentPlayer = 1 - playerIndex;
      break;
    }
    default:
      throw new Error('Unknown tic-tac-toe action.');
  }
  return next;
}
