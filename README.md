## Tech Stack

-   **Frontend:** React, TypeScript, React Router, Tailwind CSS (based on UI components)
-   **Backend:** Node.js, Express.js (likely), TypeScript
-   **Database:** Supabase (PostgreSQL)
-   **ORM:** Prisma
-   **Authentication:** Supabase Auth (Google OAuth)
-   **Deployment:** Vercel

## Design Decisions

The application is a monorepo with a React frontend and a Node.js (Express) backend.
The frontend uses TanStack Query for state management and Tailwind CSS for styling.
The backend connects to a Supabase (PostgreSQL) database via the Prisma ORM.
Authentication is handled by Supabase Auth, and the entire application is deployed on Vercel.

For more detailed information see [ARCHITECTURE.md](ARCHITECTURE.md).

## Getting Started

### Prerequisites

-   Node.js (v18 or later)
-   npm
-   A Supabase account and a new project created.

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd data-room
    ```

2.  **Install dependencies:**
    This command installs dependencies for the root, frontend, and backend.
    ```bash
    npm run install:all
    ```

3.  **Set up environment variables:**
    You'll need to get your project's `DATABASE_URL` from your Supabase project settings (under Database -> Connection string).

    Create a `.env` file in the `backend` directory:
    ```
    backend/.env
    ```

    Add your database connection string to it:
    ```env
    DATABASE_URL="postgresql://..."
    ```
    
    You will also need to set up environment variables for the frontend for Supabase authentication. Create a `.env` file in the `frontend` directory and add your Supabase URL and Anon Key from your Supabase project's API settings.
    
    ```
    frontend/.env
    ```

    ```env
    REACT_APP_SUPABASE_URL="YOUR_SUPABASE_URL"
    REACT_APP_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```


4.  **Apply database schema:**
    This command will push the schema defined in `backend/prisma/schema.prisma` to your Supabase database.
    ```bash
    npm run db:push
    ```

5.  **Start the development servers:**
    This will start both the frontend and backend servers concurrently.
    ```bash
    npm run dev
    ```
    -   Frontend will be running on `http://localhost:3000`
    -   Backend will be running on a different port (e.g., `http://localhost:3001`)

## Deployment

### Vercel

This project is configured for easy deployment to Vercel.

1.  **Connect your repository to Vercel.**
2.  Vercel should automatically detect that it is a monorepo. You will need to configure two projects, one for the frontend and one for the backend.
3.  **Frontend Configuration:**
    -   **Root Directory:** `frontend`
    -   **Build Command:** `npm run build`
    -   **Output Directory:** `build`
    -   Add your Supabase environment variables (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`) in the Vercel project settings.
4.  **Backend Configuration:**
    -   **Root Directory:** `backend`
    -   Vercel will detect the `vercel.json` and configure it as a serverless function.
    -   Add the `DATABASE_URL` environment variable in the Vercel project settings.

## Database Management

Prisma is used for database management.

-   **Generate Prisma Client:** After any changes to the `schema.prisma` file, you need to regenerate the Prisma Client.
    ```bash
    npm run db:generate
    ```
-   **Push schema changes:** To apply schema changes to the database without creating a migration.
    ```bash
    npm run db:push
    ```
-   **Create migrations:** To create a new migration file for schema changes.
    ```bash
    npm run db:migrate
    ```
-   **Prisma Studio:** To open a GUI for your database.
    ```bash
    npm run db:studio
    ```

## Available Scripts

-   `npm run dev`: Starts both frontend and backend development servers.
-   `npm run build`: Builds both frontend and backend for production.
-   `npm run test`: Runs tests for both frontend and backend.
-   `npm run install:all`: Installs all dependencies.
-   `npm run db:generate`: Generates Prisma Client.
-   `npm run db:push`: Pushes schema to the database.
-   `npm run db:migrate`: Creates a new database migration.
-   `npm run db:studio`: Opens Prisma Studio.
