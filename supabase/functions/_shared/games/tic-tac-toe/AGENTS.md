# Tic-tac-toe rules

- Exactly two players. The host plays X and goes first; the other player plays O.
- Players alternate marking empty squares, indexed 0–8.
- Three matching marks in any row, column, or diagonal wins. A full board without a winner is a draw.
- Validate membership, turns, square indices, and occupancy on the server. Reject moves after the game finishes.
- Only the host can start or end a waiting game. Joining closes when play starts.
- Leaving an active game finishes it. Leaving a waiting game transfers hosting; the new host plays X. Preserve marks on finished boards.
- Keep membership in `players` and lifecycle in `status` for the shared database policies and game limit.
