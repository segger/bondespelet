# Project

This is a private browser game lobby for a few known people; it will not be released widely.

Shared frontend code lives in `src/`; shared server code lives in `supabase/functions/_shared/`. Each game has its own README and AGENTS instructions in matching folders:

- Bondespelet: `src/games/bondespelet/` and `supabase/functions/_shared/games/bondespelet/`.
- Tic-tac-toe: `src/games/tic-tac-toe/` and `supabase/functions/_shared/games/tic-tac-toe/`.

Read the game-specific instructions when changing that game. Keep shared lobby and infrastructure code outside the game folders.

# Code rules
- Do not write in TODO.md
