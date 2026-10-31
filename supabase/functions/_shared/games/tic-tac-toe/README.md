# Tic-tac-toe server rules

`game.ts` defines the sample game's state, actions, creation, and reducer. The shared `../../games.ts` dispatcher selects it for `kind: 'tic-tac-toe'`.

The game has two players with persistent X/O marks, nine cells, and a current player. The reducer validates membership, host permissions, turns, and empty squares, and detects wins and draws. Leaving an active game finishes it; leaving a waiting game transfers hosting. Finished boards retain their marks.

The game keeps membership in `players` and lifecycle in `status` so the shared database permissions and unfinished-game limit apply.

See the [UI README](../../../../../src/games/tic-tac-toe/README.md). From the project root, run `npm test` and `npm run build`. `tests/tic-tac-toe.test.ts` covers the rules; `npm run test:integration` checks the shared endpoint with local Supabase running.
