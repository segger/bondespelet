# Tic-tac-toe

A playable sample game for two players, opened from the shared lobby.

The host plays X and goes first; the other player plays O. Players choose empty squares in turn. Three matching marks in a row, column, or diagonal wins; a full board without a winner is a draw. Progress is saved after every move.

`TicTacToe.tsx` owns the screen, board, player list, and displayed rules. It uses the shared lobby and session and sends `mark` actions with square indices 0–8.

See the [server rules](../../../supabase/functions/_shared/games/tic-tac-toe/README.md) for state and validation. From the project root, run `npm test` and `npm run build`. Tests are in `tests/tic-tac-toe.test.ts`; the shared integration suite also plays a complete round.
