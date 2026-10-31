export const gameCatalog = {
  bondespelet: { name: 'Nya bondespelet', capacities: [2, 3, 4], description: 'Grow crops, trade buildings, and buy the castle to win.' },
  'tic-tac-toe': { name: 'Tic-tac-toe', capacities: [2], description: 'A sample game. Take turns placing X and O; get three in a row to win.' },
} as const;

export type GameKind = keyof typeof gameCatalog;
export type LobbyPlayer = { id: string; name: string };
export type GameBase<P extends LobbyPlayer = LobbyPlayer> = {
  status: 'waiting' | 'playing' | 'finished';
  capacity: number;
  players: P[];
  currentPlayer: number;
  winner?: LobbyPlayer;
  lastMove: string;
};

export function playerName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) {
    throw new Error('Choose a name between 1 and 24 characters.');
  }
  return name.trim();
}
