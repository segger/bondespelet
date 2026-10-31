# Nya bondespelet

A farm board game for 2–4 players, opened from the shared lobby.

Players first roll a six-sided die to decide turn order, highest to lowest. Tied players reroll among themselves until their order is settled. Preparation happens once per game: each player chooses a croft, plants at least one crop, and confirms planting before the next player chooses a croft. Normal turns begin only after everyone has confirmed; planting is unavailable during normal turns. Every turn begins with a die roll that moves the marker along the numbered white spaces. Moving past space 108 finishes the year for that player; their marker stops one step after 108, and they wait while the others finish. Landing on 108 does not finish the year. The player clicks **End turn** after moving. When the last finishing turn ends, the next year uses the players’ finish order. Markers reset to 0 and crops return to the stacks. Before planting, each player may sell their building and buy an available one using the sale proceeds. Crofts cost and sell for **50,000 kr**, farms for **200,000 kr**, and mansions for **750,000 kr**. Buying the castle for **2,500,000 kr** ends the game and makes the buyer the winner. Everyone plants and confirms in the new order before movement resumes. Rolls and marker positions are saved. Other landing-space actions are not implemented yet.

Initial planting is free. At year shifts, each crop costs **1,000 kr for a croft**, **3,000 kr for a farm**, or **10,000 kr for a mansion**. Planting deducts the cost immediately; returning an unconfirmed crop refunds it. Players who cannot afford a single crop can continue with empty fields.

The game host can toggle **Debug mode** above the game. While enabled, the host can make opening rolls and perform the current player’s croft selection, planting, rolls, and end-turn actions. The fields panel shows the player being controlled. Other players keep their usual permissions; disabling debug restores the host’s own controls.

## Code

- `Bondespelet.tsx`: game screen, lobby integration, and debug controls.
- `Board.tsx`: SVG regions, building selection, and player markers. Artwork is in `public/board.svg` at the project root.
- `game.ts`: derived UI state and available controls.
- `gameplay.tsx`: resources, planting, buildings, harvest, and turn controls.
- `setup.tsx`: croft picker and displayed rules.
- [Server rules](../../../supabase/functions/_shared/games/bondespelet/README.md): authoritative state and action validation.

From the project root, run `npm test` and `npm run build`. Game tests are in `tests/`; `npm run test:integration` checks the shared endpoint with local Supabase running.
