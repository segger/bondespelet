# Bondespelet server rules

Authoritative state and action validation for Nya bondespelet. The shared `../../games.ts` dispatcher selects this game for `kind: 'bondespelet'` and for older saves without a kind.

- `game.ts`: action reducer and exports used by the app, tests, and Edge Function.
- `types.ts`: state, actions, player colors, crops, buildings, and board constants.
- `lifecycle.ts`: creation, ending waiting games, and leaving.
- `setup.ts`: joining, colors, starting, opening rolls, and croft selection.
- `gameplay.ts`: movement, harvesting, turn order, and year changes.
- `planting.ts`: preparation, crop returns, and planting confirmation.
- `buildings.ts`: buying and selling buildings and the castle win condition.

See the [game README](../../../../../src/games/bondespelet/README.md) for the implemented rules and UI. The local `AGENTS.md` records the game's intended rules, including mechanics still to be implemented.

From the project root, run `npm test` and `npm run build`. Run `npm run test:integration` with the local Supabase stack and Edge Function running to verify persistence, permissions, and saved-game compatibility.
