# Architecture

-   **Monorepo Architecture:** The frontend and backend are housed within a single repository to simplify development, dependency management, and deployment.
-   **TypeScript End-to-End:** TypeScript is used for both the frontend and backend to ensure type safety, improve code quality, and enhance developer experience.
-   **Supabase for Backend Services:** Supabase is utilized as an all-in-one backend solution, providing a PostgreSQL database, user authentication, and file storage. This simplifies the backend infrastructure.
-   **Prisma for Database Access:** Prisma serves as the ORM, offering a type-safe and intuitive API for database operations. It works seamlessly with TypeScript.
-   **Component-Based UI:** The frontend is built using a component-based architecture with a clear separation of concerns, making the UI modular and reusable.
-   **Vercel for Deployment:** Vercel is chosen for its seamless integration with modern web frameworks, CI/CD capabilities, and serverless functions for the backend.
