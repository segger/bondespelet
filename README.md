# Bondespelet

A private browser game lobby for a few known friends, using React, TypeScript, Vite, SVG, and Supabase. Choose **Nya bondespelet** (2–4 players) or **Tic-tac-toe** (2 players), create a game, and share its invite link. The host creates accounts for the group. Players sign in and take turns whenever they are online. The group can have up to **5 unfinished games** across both game types, including waiting lobbies; finished games remain saved and free a slot. Saved games are labelled by game type. Existing Bondespelet saves and invite links continue working.

Game rules and code notes live with each game:

- [Nya bondespelet](src/games/bondespelet/README.md) · [server rules](supabase/functions/_shared/games/bondespelet/README.md).
- [Tic-tac-toe](src/games/tic-tac-toe/README.md) · [server rules](supabase/functions/_shared/games/tic-tac-toe/README.md).

## Run locally

Requires Node.js 22.12+ and Docker running. The Supabase CLI is included as a development dependency.

```sh
npm install
npm run supabase:start
cp .env.example .env
```

Copy the local **anon** key (or publishable key) printed by Supabase into `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. The local URL is `http://127.0.0.1:54321`. Use only the public key here; service-role keys belong exclusively on the server.

Run these commands in separate terminals:

```sh
npm run supabase:functions
```

```sh
npm run dev
```

Open Supabase Studio at `http://127.0.0.1:54323`. Under **Authentication → Users → Add user → Create new user**, create an email/password account for each friend and enable **Auto Confirm User**. Public sign-ups and anonymous sign-ins are disabled in `supabase/config.toml`. After changing Auth settings, restart the local stack with `npm run supabase:stop` and `npm run supabase:start`.

Open the Vite URL, sign in, create a game, and copy its invite link. Open the link in another browser or private window and sign in with a second account to join as a different player. Tabs in the same browser profile share a signed-in account. The host can start with at least two players; new players cannot join after the start. Invite links let existing accounts join a game; they do not create accounts.

For a second device on your network, run `npm run dev -- --host 0.0.0.0`, set `VITE_SUPABASE_URL` to your development machine's LAN address at port `54321`, and open the Vite LAN URL on both devices. Both ports must be reachable.

Games are saved after every accepted move and listed on the home screen. Sign in with the same account on another device to return to your games. The host manages accounts and password resets through Supabase. There are no turn notifications yet.

If unused lobbies fill the game limit, the host can delete them from the `games` table in Studio. The limit is enforced in the database, including simultaneous creation requests. To change it, add a migration replacing `public.create_game` from `supabase/migrations/20261029010000_private_games.sql`, and update the app's limit text.

```sh
npm test
npm run build
npm run test:integration
npm run supabase:stop
```

`test:integration` requires the local Supabase stack and Edge Function running, with migrations applied and at least one free game slot. It checks both game types, older Bondespelet saves, private sign-in, disabled public sign-ups, the shared game limit under concurrent creation, rejected illegal moves, concurrent submissions, database permissions, persistence, and Realtime delivery. It creates temporary accounts through the admin API and removes its test games and users afterward.

## Use hosted Supabase

1. Create a Supabase project. In **Authentication → Sign In / Providers**, keep email/password sign-in enabled, disable **Allow new users to sign up**, and disable **Allow anonymous sign-ins**. Hosted Auth settings must be changed in the dashboard; `supabase/config.toml` controls local development.
2. Run `npx supabase login`, then `npx supabase link --project-ref YOUR_PROJECT_REF`.
3. Apply the database migration with `npx supabase db push`.
4. Deploy the move endpoint with `npx supabase functions deploy game-action`.
5. Create your friends' email/password accounts under **Authentication → Users**, with **Auto Confirm User** enabled. Put the project's URL and publishable key in `.env`, then run `npm run dev` or `npm run build`.

Existing anonymous sessions cannot play or read games after this change. Before switching an existing group, link their anonymous users to email/password accounts to preserve their player IDs and game membership.

Deploy `dist/` to a static host when ready. Environment values are embedded at build time. The Edge Function receives its Supabase URL and service-role key from Supabase automatically. Its handler validates the caller's user token with Auth before accessing game data; `verify_jwt = false` disables only the gateway's legacy JWT check.

## Where to change the game

- `src/games/bondespelet/` and `src/games/tic-tac-toe/`: game screens and controls, each with its own README and AGENTS instructions.
- `supabase/functions/_shared/games/bondespelet/` and `supabase/functions/_shared/games/tic-tac-toe/`: each game's authoritative state and rules, with its own README and AGENTS instructions.
- `src/App.tsx`: shared app shell and selection of each game's screen.
- `src/Lobby.tsx` and `src/lifecycle.ts`: shared sign-in, creation, invitations, saved games, navigation, and Realtime updates.
- `supabase/functions/_shared/catalog.ts`: game names, supported capacities, and common state fields. Membership stays in `state.players` and lifecycle in `state.status` for database policies and the game limit.
- `supabase/functions/_shared/games.ts`: shared state/action types and server dispatch. Creation uses the selected `kind`; later moves use the saved state's `kind`. Missing kinds identify older Bondespelet games.
- `supabase/functions/game-action/index.ts`: authentication and action endpoint.
- `supabase/migrations/`: database access and atomic version-checked saves. Run `npm run supabase:reset` after changing migrations during development; this deletes local database data.

To add another game, create matching game folders with a README and AGENTS instructions, add its catalog entry and server dispatch, then its screen in `src/App.tsx`. No database migration is needed for these two games: `kind` is stored inside the existing JSON state.

Clients can read only games they belong to and cannot write game state. Every move is validated on the server, then committed only if the saved version has not changed. Realtime updates, tab-focus refreshes, and periodic refetches keep clients current. Both games have no hidden information; private hands/cards would need a separate protected model before adding them.

References: [Supabase Auth settings](https://supabase.com/docs/guides/auth/general-configuration), [password sign-in](https://supabase.com/docs/guides/auth/passwords), [Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [Vite](https://vite.dev/guide/).
