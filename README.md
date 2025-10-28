# 📁 Data Room - Secure Document Management System

A comprehensive, full-stack web application for secure file and folder management with real-time collaboration features. Built with modern technologies and designed for enterprise-grade security and performance.

## 🌟 Features

- **🔐 Secure Authentication** - Google OAuth integration via Supabase
- **📂 Hierarchical File Management** - Create, organize, and manage folders and files
- **🔍 Advanced Search** - Search across all files and folders with debounced input
- **📱 Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **⚡ Real-time Updates** - Optimistic UI updates with React Query
- **🎨 Modern UI** - Clean, intuitive interface built with Tailwind CSS
- **🔒 Enterprise Security** - JWT-based authentication with CORS protection
- **📊 File Tree Navigation** - Visual file browser similar to VS Code
- **🚀 Performance Optimized** - Lazy loading, caching, and code splitting

## 🏗️ Architecture Overview

This is a **monorepo** containing both frontend and backend applications:

```
data-room/
├── frontend/          # React + TypeScript frontend
├── backend/           # Node.js + Express API
├── fixes/            # Documentation and fixes
└── package.json      # Root package with scripts
```

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- React Query for data fetching and caching
- React Router for navigation
- Tailwind CSS for styling
- Lucide React for icons
- Axios for HTTP requests

**Backend:**
- Node.js with Express
- TypeScript for type safety
- Prisma ORM with PostgreSQL
- Supabase for authentication and file storage
- Vercel serverless functions
- JWT for API authentication

**Database:**
- PostgreSQL (via Supabase)
- Prisma for database management
- Cascading deletes for data integrity

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- Google OAuth credentials

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd data-room

# Install all dependencies
npm run install:all
```

### 2. Environment Setup

#### Backend Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/datroom_db"

# Supabase Configuration
SUPABASE_URL="your-supabase-project-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key"

# Google OAuth (optional - for custom OAuth flow)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Frontend URL
FRONTEND_URL="http://localhost:3000"
```

#### Frontend Environment Variables

Create `frontend/.env`:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL="your-supabase-project-url"
REACT_APP_SUPABASE_ANON_KEY="your-supabase-anon-key"

# API Base URL
REACT_APP_API_URL="http://localhost:3001"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# (Optional) Seed database with sample data
cd backend && npm run db:seed
```

### 4. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:frontend  # Frontend on http://localhost:3000
npm run dev:backend   # Backend on http://localhost:3001
```

## 🌐 Deployment

### Vercel Deployment (Recommended)

This project is optimized for Vercel deployment with serverless functions.

#### 1. Deploy Backend

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy backend
cd backend
vercel

# Set environment variables in Vercel dashboard
```

#### 2. Deploy Frontend

```bash
# Deploy frontend
cd frontend
vercel

# Set environment variables in Vercel dashboard
```

#### 3. Environment Variables for Production

Set these in your Vercel project settings:

**Backend Environment Variables:**
- `DATABASE_URL` - Your PostgreSQL connection string
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `JWT_SECRET` - A secure random string
- `FRONTEND_URL` - Your frontend domain (e.g., `https://your-app.vercel.app`)

**Frontend Environment Variables:**
- `REACT_APP_SUPABASE_URL` - Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `REACT_APP_API_URL` - Your backend API URL (e.g., `https://your-api.vercel.app`)

### Local Production Build

```bash
# Build both applications
npm run build

# Start production servers
cd backend && npm start
cd frontend && npm start
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start only frontend
npm run dev:backend      # Start only backend

# Building
npm run build            # Build both applications
npm run build:frontend   # Build only frontend
npm run build:backend    # Build only backend

# Testing
npm run test             # Run all tests
npm run test:frontend    # Run frontend tests
npm run test:backend     # Run backend tests

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate        # Run database migrations
npm run db:studio        # Open Prisma Studio
```

### Project Structure

```
frontend/src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI components (Button, Input, etc.)
│   ├── FileTree.tsx    # File tree navigation component
│   ├── Layout.tsx      # Main layout wrapper
│   └── PrivateRoute.tsx # Route protection component
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication context
├── lib/                # Utility libraries
│   ├── api.ts          # API client configuration
│   ├── supabase.ts     # Supabase client
│   ├── utils.ts        # Utility functions
│   ├── toast.ts        # Toast notifications
│   └── errorMessages.ts # Error message constants
├── pages/              # Page components
│   ├── Login.tsx       # Login page
│   ├── Signup.tsx      # Signup page
│   ├── DataRooms.tsx   # Data rooms listing
│   └── DataRoomView.tsx # Individual data room view
└── types/              # TypeScript type definitions

backend/
├── api/                # Vercel serverless functions
│   ├── _cors.ts        # CORS middleware
│   ├── data-rooms.ts  # Data rooms API
│   ├── folders.ts     # Folders API
│   └── files.ts        # Files API
├── prisma/             # Database schema and migrations
│   ├── schema.prisma   # Database schema
│   └── seed.ts         # Database seeding
└── src/                # Source code (legacy)
```

## 🔧 Configuration

### Supabase Setup

1. Create a new Supabase project
2. Enable Google OAuth in Authentication settings
3. Add your domain to allowed origins
4. Create a storage bucket for file uploads
5. Set up Row Level Security (RLS) policies

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000` (development)
   - `https://your-domain.com` (production)
   - `https://your-supabase-project.supabase.co/auth/v1/callback`


## 📚 Design Decisions

### Why These Technologies?

**React + TypeScript:**
- Type safety prevents runtime errors
- Excellent developer experience
- Large ecosystem and community support

**React Query:**
- Automatic caching and background updates
- Optimistic updates for better UX
- Built-in loading and error states

**Prisma:**
- Type-safe database queries
- Excellent migration system
- Works well with serverless environments

**Supabase:**
- Handles authentication complexity
- Built-in file storage
- Real-time capabilities
- PostgreSQL with excellent tooling

**Vercel:**
- Optimized for React and serverless functions
- Excellent developer experience
- Built-in CI/CD
- Global CDN

### Architecture Decisions

**Monorepo Structure:**
- Easier dependency management
- Shared types and utilities
- Single deployment pipeline

**Serverless Functions:**
- Automatic scaling
- Pay-per-use pricing
- No server management

**JWT Authentication:**
- Stateless authentication
- Works well with serverless
- Secure and scalable

**CORS Middleware:**
- Centralized CORS handling
- Consistent security policies
- Easy to maintain

## 🔮 Future Enhancements

- [ ] Real-time collaboration features
- [ ] Advanced file versioning
- [ ] Bulk operations (upload, download, delete)
- [ ] Advanced search with filters
- [ ] User roles and permissions
- [ ] Audit logs and activity tracking
- [ ] Mobile app (React Native)
- [ ] API rate limiting and analytics
- [ ] Advanced security features (2FA, SSO)

---

**Built with ❤️ using modern web technologies**
