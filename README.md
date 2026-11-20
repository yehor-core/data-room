# Data Room

Store PDF files in data rooms with nested Folders. Sign-in is through Google (Supabase Auth).

For the stack, the module structure, the test strategy and CI, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Getting started

Prerequisites: Node.js 24 (see `.nvmrc`) with npm, and a Supabase project for local development against real
services. Running the tests does not need a Supabase project.

1. Install the dependencies of the root, `backend/` and `frontend/`. Each has its own lockfile.

   ```bash
   npm run install:all
   ```

   Installing the root also installs the git hooks. The pre-commit hook needs
   [gitleaks](https://github.com/gitleaks/gitleaks#installing) on your `PATH`.

2. Create the environment files from the examples, then fill them in from your Supabase project's settings.

   ```bash
   cp backend/env.example backend/.env
   cp frontend/env.example frontend/.env.local
   ```

   - `backend/.env`: `DATABASE_URL` is the pooled (pgbouncer, port 6543) connection string the app uses.
     `DIRECT_URL` is the direct (port 5432) one that migrations use. Also set `SUPABASE_URL`,
     `SUPABASE_SERVICE_ROLE_KEY` and `ALLOWED_ORIGINS` (the frontend's origin).
   - `frontend/.env.local`: `REACT_APP_API_URL` (the backend URL ending in `/api`), `REACT_APP_SUPABASE_URL` and
     `REACT_APP_SUPABASE_ANON_KEY`.

3. Apply the migrations to your database. If the database was created before migrations were tracked, see
   [Existing databases](#existing-databases) first.

   ```bash
   npm run db:migrate
   ```

4. Start the backend (port 3001) and the frontend (port 3000).

   ```bash
   npm run dev
   ```

## Scripts

Run these from the repository root.

| Script                     | What it does                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Starts the backend and the frontend dev servers (`dev:backend`, `dev:frontend` start one each).                                                         |
| `npm run build`            | Builds both packages.                                                                                                                                   |
| `npm run install:all`      | Installs the dependencies of all three install roots.                                                                                                   |
| `npm run lint`             | ESLint over the whole repository, no warnings allowed.                                                                                                  |
| `npm run format`           | Formats everything with Prettier. `format:check` only checks.                                                                                           |
| `npm run typecheck`        | TypeScript checks of both packages.                                                                                                                     |
| `npm run deadcode`         | knip: unused files, exports and dependencies in all three install roots.                                                                                |
| `npm run test:unit`        | Unit tests of both packages.                                                                                                                            |
| `npm run test:integration` | Integration tests of both packages: backend over HTTP against real Postgres, frontend screens over MSW.                                                 |
| `npm run test:coverage`    | Unit and integration tests of both packages in one coverage run per package. Fails below the thresholds in [ARCHITECTURE.md](ARCHITECTURE.md#coverage). |
| `npm run test:e2e`         | Playwright against the full local stack. See [End-to-end tests](#end-to-end-tests).                                                                     |
| `npm run db:test`          | Starts a local Postgres for the backend integration tests. See [Test database](#test-database).                                                         |
| `npm run db:generate`      | Regenerates the Prisma client after a change to `backend/prisma/schema.prisma`.                                                                         |
| `npm run db:migrate`       | Applies the existing migrations only (`prisma migrate deploy`, as CI does) to the database in `backend/.env`.                                           |
| `npm run db:migrate:dev`   | Creates a new migration from schema changes and applies it (`prisma migrate dev`) to the database in `backend/.env`. For development only.              |
| `npm run db:studio`        | Opens Prisma Studio.                                                                                                                                    |

The same two scripts exist in `backend/` with the same meaning.

## Tests

### Test database

The backend integration tests need Postgres. You do not need to install or start anything: when `TEST_DATABASE_URL`
is not set, the tests start a throwaway embedded Postgres and apply all migrations to it.

To keep one database running between test runs, start it in another terminal and export the URL it prints:

```bash
npm run db:test   # Postgres on port 54329 (TEST_DB_PORT changes it), all migrations applied
export TEST_DATABASE_URL=postgresql://...   # the URL printed by db:test
npm run test:integration
```

### End-to-end tests

The e2e tests run in Chromium against a full local stack. The local Supabase stack (Postgres, Auth, Storage, from
`supabase/config.toml`) runs on ports 54321–54322. The backend runs with its production adapters on port 3101, and
the frontend production build is served on port 3100. No cloud credentials are needed.

Prerequisites: the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) on your
`PATH` (it starts the stack in Docker), and Chromium for Playwright:

```bash
cd frontend && npx playwright install chromium
```

Then:

```bash
npm run test:e2e
```

This starts local Supabase, builds and starts the backend and the frontend, and runs the specs in `frontend/e2e/`.
Stop the stack with `supabase stop`. The HTML report is written to `frontend/playwright-report/`.

## Deployment

Vercel deploys two projects from this repository:

- **Frontend**: root directory `frontend`, build command `npm run build`, output directory `build`. Environment:
  the variables from `frontend/env.example`, with `REACT_APP_API_URL` pointing at the deployed backend's `/api`.
- **Backend**: root directory `backend`. `backend/vercel.json` deploys the whole API as one serverless function.
  Environment: the variables from `backend/env.example`, with `ALLOWED_ORIGINS` set to the deployed frontend's
  origin.

Deployments do not run migrations. Apply them with `npm run db:migrate` and `backend/.env` pointed at
the production database.

### Existing databases

- **Database created with `prisma db push`** (before migrations were tracked): mark the baseline as applied once,
  then deploy the remaining migrations.

  ```bash
  cd backend
  npx prisma migrate resolve --applied 0_init
  npm run db:migrate
  ```

- **Duplicate names**: migration `20261119120000_unique_names` adds unique name indexes. First it checks for data
  rooms, Folders and Files that share a name with a sibling. If there are any, it stops, applies nothing and lists
  them in the error detail. Rename or delete the duplicates, then mark the failed migration as rolled back and deploy
  again:

  ```bash
  cd backend
  npx prisma migrate resolve --rolled-back 20261119120000_unique_names
  npm run db:migrate
  ```
