# Architecture

Data Room lets a signed-in user keep PDF files in data rooms with nested Folders. The repository has two deployable
packages and a root that only holds shared tooling:

- `backend/`: an Express API over Postgres (Prisma) and Supabase Storage.
- `frontend/`: a React single-page app (Create React App with craco, React Router 7, TanStack Query, Tailwind CSS,
  Radix UI primitives).
- root: ESLint, Prettier, knip, husky and the commands that run each package's scripts.

Each of the three has its own `package-lock.json` (no npm workspaces), because Vercel deploys `backend/` and
`frontend/` as two projects with separate root directories.

The database schema is [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). The HTTP API (envelopes, error
codes, endpoints) is pinned by the backend integration tests in `backend/test/`.

## Authentication

The frontend signs in with Google through Supabase Auth (`frontend/src/lib/supabase.ts`) and sends the Supabase access
token as `Authorization: Bearer <token>` on every API request. The backend does not check the JWT itself: the
production token verifier asks Supabase Auth for the token's user (`supabase.auth.getUser(token)`) and gets back an
email and a name, or a refusal.

`backend/src/middleware/auth.ts` is mounted once, in front of every `/api` route except `GET /api/health`. It verifies
the token once per request and finds or creates the user by email, so the first request creates the account.

## Backend

### App factory, ports and adapters

`createApp` in `backend/src/app.ts` builds the Express app from its dependencies and does nothing else: no
environment reads and no `listen`.

```ts
createApp({ db, storage, tokenVerifier, logger, config });
```

The two external systems are ports, each an interface in `backend/src/ports.ts`:

- `FileStorage`: `put`, `signedUrl`, `remove`. The storage path format belongs to the adapter.
- `TokenVerifier`: `verify(token)` returns an identity or null.

Each port has a production adapter in `backend/src/adapters/supabase.ts`, which uses one service-role Supabase client
for both ports. Its test adapters (in-memory storage and a fake verifier that issues tokens) are in
`backend/test/adapters.ts`.

`backend/src/index.ts` is the only place that wires production dependencies: Prisma, the Supabase adapters, the logger
and `config`. Outside production it also starts a server.

Other backend modules:

- `config/`: reads and validates the environment once. No other module reads `process.env`.
- `lib/logger.ts`: the only way backend code writes logs. Emails, tokens and session contents are never logged.
- `lib/prisma.ts`: the production Prisma client.
- `errors.ts`: `AppError`, a typed error with a code.
- `middleware/`: `auth.ts`, `validate.ts` (express-validator rules) and `errorHandler.ts`. The error handler turns
  `AppError`, malformed JSON and multer errors into the error envelope. Anything else becomes a 500 with a generic
  message.

The app also applies `helmet`, CORS limited to `ALLOWED_ORIGINS`, `morgan` request logs through the logger, and a
rate limit of 100 requests per 15 minutes per IP.

### Access module

`backend/src/access/` owns the rules for what a user may do with data rooms, Folders and Files.
`createDataRoomAccess(deps, userId)` returns the operations available to that user:

- **Ownership.** A Folder or File belongs to the user who owns its data room. A resource owned by someone else gets
  the same 404 as one that does not exist.
- **Names.** Names are trimmed. They must be unique among siblings, checked on create and on rename. Unique indexes
  in the database enforce this, so two concurrent requests cannot both succeed. A violation becomes 409 `CONFLICT`.
- **Contents.** One `contents` operation serves the data room root and every Folder: the level's Folders and Files
  plus a breadcrumb (`folderTree.ts`).
- **Uploads.** Files are PDF only, checked by both the declared type and the `%PDF-` signature, up to 4 MB
  (`uploads.ts`). If the database rejects the record after the content was stored, the stored object is removed.
- **Deletes.** Deleting a data room or Folder cascades in the database and removes the stored content of every File
  under it.

Routes (`backend/src/routes/`) only validate input and call the access module through `accessFor(req)`. `route()`
sends the result in the `{ success: true, data }` envelope; `undefined` becomes 204.

### Deployment

`backend/vercel.json` builds `src/index.ts` with `@vercel/node` and rewrites every `/api/*` path to it, so the whole
API is **one** serverless function. Vercel caps a request body at 4.5 MB, which is why the file limit is 4 MB.

### Migrations

The schema changes only through Prisma migrations in `backend/prisma/migrations/`, starting from the `0_init`
baseline. `DATABASE_URL` is the pooled (pgbouncer) URL the app uses. `DIRECT_URL` is the direct connection that
migrations use. CI applies every migration to a fresh Postgres before the backend tests run. The README covers the
one-time steps for databases created before migrations were tracked.

## Frontend

```
src/
  data/        client data module: API client, read hooks, mutations, Items, upload rules
  pages/       Login, DataRooms (the list), DataRoomPage (one screen for the root and every Folder)
  components/  Layout (sidebar FileTree + actions provider), DataRoomActions, DataRoomView/*, dialogs, ui/*
  contexts/    AuthContext (Supabase session + profile)
  lib/         supabase client, error messages, toast, formatting, screen paths
  hooks/       useDebounce (search input)
  types/       API data shapes
```

### Client data module

`frontend/src/data/` is the only code that knows about HTTP or the query cache.

- `api.ts`: the axios client. It attaches the access token and unwraps the envelope. It turns every failure into an
  `ApiError` with a code, including Vercel's own 413 without an envelope, the plain-text 429, network errors and
  timeouts. It never notifies the user.
- `dataRoom.ts`: `useDataRoomContents(dataRoomId, folderId)` reads one level. `useDataRoomMutations(dataRoomId)`
  creates, renames, deletes and uploads. `openFile(fileId)` opens a File through a short-lived signed URL.
- `dataRooms.ts`: the list of data rooms, with create and delete.
- `session.ts`: hands the session's access token to the API client, loads the profile, and clears every cached
  response when the session ends.
- `optimistic.ts`: the shared optimistic-update pattern. It patches the cached queries the change affects (for a
  data room, every cached level), marks new Items as pending, and rolls back and shows exactly one toast on failure.
  When the change settles it refetches only what shows it: the level it happened in, the level whose Folder card
  counts it changed, every level whose breadcrumb shows a renamed Folder, and the data rooms list when a Folder was
  created or deleted (the list shows Folder counts).
- `items.ts`: turns Folders and Files into `Item`s (Folders first, then by name) and filters them for search.
- `uploads.ts`: the client copy of the upload rules (4 MB, PDF), checked before any request is sent.
- `queryKeys.ts`: the cache keys, used only inside `data/`. `queryClient.ts`: query defaults (retry only network,
  timeout and server errors, once).

A failed read becomes an error state with a retry button on the screen. A failed mutation becomes one toast built
from its error code (`lib/errorMessages.ts`).

### Screen and actions provider

`DataRoomPage` is one screen for the data room root and every Folder; the Folder id in the URL is optional. Grid,
list, search, breadcrumb and empty states are shared by every level.

`DataRoomActionsProvider` (`components/DataRoomActions.tsx`) is mounted by `Layout` around both the sidebar
`FileTree` and the screen. It holds the dialogs (create Folder, rename, upload, confirm delete) and exposes
`openItem`, `startCreateFolder`, `startUpload`, `renameItem` and `deleteItem`. The single `ItemMenu` calls these
actions wherever an Item appears: grid, list and tree, from its button or by right-click.

`AuthContext` takes the session from Supabase's auth events, passes it to `data/session.ts` and loads the profile
(`GET /api/auth/me`) through it once per app start. `PrivateRoute` sends signed-out visitors to `/login`.

## Tests

Tests check observable behaviour through a module's public interface. Mocks are only used at the external seams:
file storage, token verification, and the network on the frontend. Prisma and Postgres are never mocked.

| Seam                 | What runs                                                                                                                                              | Where                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Backend integration  | The app from `createApp` with real Postgres, in-memory storage and the fake token verifier, driven over HTTP with supertest. Covers every access rule. | `backend/test/*.integration.test.ts`                                           |
| Frontend integration | Whole screens with the real providers, memory router and data module. MSW intercepts HTTP.                                                             | `frontend/src/__tests__/integration/*.integration.test.tsx`                    |
| E2E                  | Playwright in Chromium against the full local stack: Supabase CLI (Postgres, Auth, Storage), the backend with its production adapters, the built app.  | `frontend/e2e/`                                                                |
| Unit                 | Pure modules: Item sorting and search, breadcrumb, upload rules, error mapping, config, formatting; UI primitives only where they add behaviour.       | `backend/src/**/__tests__/`, `frontend/src/__tests__/{data,utils,components}/` |

Backend integration tests use `TEST_DATABASE_URL` when it is set (the CI service container, or `npm run db:test`).
Otherwise jest's global setup starts a throwaway embedded Postgres. Either way all migrations are applied first.

E2E signs in without any test-only code path. The test user is created through the local Supabase admin API, its
session is saved as Playwright storage state, and Google OAuth is only checked up to the redirect.

### Coverage

Each package measures coverage in one jest run that executes both its unit and integration tests, so code exercised
by either suite counts. `npm run test:coverage` (root or package) runs it and fails when coverage drops below these
thresholds:

| Scope                                                   | Lines | Branches |
| ------------------------------------------------------- | ----- | -------- |
| `backend/src/access/` (access module)                   | 90%   | 90%      |
| `frontend/src/data/` (client data module)               | 90%   | 90%      |
| the rest of `backend/src/`, the rest of `frontend/src/` | 80%   | —        |

The thresholds live in `backend/jest.coverage.config.js` and in the `jest` block of `frontend/package.json`. Test
helpers are not counted. E2E does not contribute to coverage.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. A new push cancels the outdated run
for the same ref, and the token is read-only.

1. **Lint, format, typecheck, dead code**: `npm run lint`, `format:check`, `typecheck`, `deadcode` (knip).
2. **Backend unit + integration**: a Postgres service container, `prisma migrate deploy`, then the coverage run.
3. **Frontend unit + integration**: the coverage run.
4. **E2E**: runs after the first three jobs pass. Starts local Supabase and runs `npm run test:e2e`. If it fails, it
   uploads the Playwright report, traces and screenshots.
5. **Build**: both packages.

Jobs 2 and 3 upload their coverage reports (`lcov` and a summary) as artifacts, whether they pass or fail.

Locally, a husky pre-commit hook runs gitleaks on the staged changes, then ESLint and Prettier through lint-staged.
The pre-push hook runs `typecheck` and `test:unit`.
