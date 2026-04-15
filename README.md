# Classroom Management System

A full-stack classroom management platform with a React frontend, Express backend, and an AI-powered voice assistant service.

---

## Architecture Overview

```
classroom/
├── classroom-frontend/     # React 19 SPA (Vite + Refine.dev)
├── classroom-backend/      # Express REST API (TypeScript + Drizzle + PostgreSQL)
├── voice-service/          # NestJS AI voice assistant (WebSocket + OpenAI Realtime)
└── docker-compose.yml      # Orchestrates all three services
```

---

## Services

### 1. classroom-frontend

**Port:** `5173`  
**Stack:** React 19, TypeScript, Vite, Refine.dev v5, Shadcn/ui, Tailwind CSS v4

#### Features
- **Dashboard** — 8 stat cards, 4 Recharts charts, recent activity feed
- **Departments** — Full CRUD (list, create, edit, show)
- **Subjects** — Full CRUD (list, create, edit, show)
- **Classes** — Full CRUD with enrollment management, invite code copy, capacity warning at 80%
- **Users** — Full CRUD with profile image upload via Cloudinary
- **Voice Assistant** — Book upload + AI voice chat (push-to-talk with OpenAI Realtime)
- **Auth** — Login / Register pages with `better-auth` session management
- **Role Guard** — Route-level access control (`admin`, `teacher`, `student`)
- **Theme** — Light/dark mode via `next-themes`
- **Command Palette** — Refine KBar (`Cmd+K`)

#### Key Configuration (`src/`)
| Path | Purpose |
|------|---------|
| `src/App.tsx` | Routes, Refine resources, auth guards |
| `src/prodivers/data.ts` | REST data provider (`@refinedev/rest`) |
| `src/types/index.ts` | Shared TypeScript types |
| `src/lib/schema.ts` | Zod validation schemas |
| `src/lib/cloudinary.ts` | Cloudinary upload helper |
| `src/constants/index.ts` | App-wide constants |

#### Environment Variables (`.env`)
| Variable | Description |
|----------|-------------|
| `VITE_BACKEND_BASE_URL` | Backend API base URL (e.g. `http://<host>:8000/api/`) |
| `VITE_VOICE_SERVICE_URL` | Voice service URL (e.g. `http://<host>:3001`) |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `VITE_CLOUDINARY_UPLOAD_URL` | Cloudinary upload endpoint |

#### Scripts
```bash
npm run dev      # Start dev server (via Refine CLI)
npm run build    # Production build
npm run start    # Serve production build
```

---

### 2. classroom-backend

**Port:** `8000`  
**Stack:** Express 5, TypeScript, Drizzle ORM, PostgreSQL (Neon), better-auth, Arcjet

#### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/api/departments` | Departments CRUD |
| GET/POST/PUT/DELETE | `/api/subjects` | Subjects CRUD |
| GET/POST/PUT/DELETE | `/api/classes` | Classes CRUD |
| GET/PUT/DELETE | `/api/users` | Users management |
| GET/POST/DELETE | `/api/enrollments` | Enrollments (filter: `?classId=X`) |
| GET | `/api/dashboard/stats` | Overview numbers |
| GET | `/api/dashboard/charts` | Chart data + recent activity |
| POST/all | `/api/auth/*` | better-auth (login, register, session) |

#### Security Middleware (Arcjet)
Role-based rate limiting via a sliding window (1-minute interval):

| Role | Requests/min |
|------|-------------|
| `admin` | 100 |
| `teacher` | 40 |
| `student` | 30 |
| `guest` | 15 |

Also blocks: bot traffic, shield-flagged requests.

#### Database
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL via Neon serverless driver
- **Schema:** `src/db/schema/`
- **Migrations:** `drizzle/` directory

```bash
npm run db:generate   # Generate migration files
npm run db:migrate    # Apply migrations
```

#### Monitoring
Site24x7 APM (apminsight) is initialized at app startup.

#### Environment Variables (`.env`)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `FRONTEND_URL` | Comma-separated allowed origins for CORS |
| `ARCJET_KEY` | Arcjet API key for security middleware |
| `BETTER_AUTH_SECRET` | Secret for better-auth session signing |
| `NODE_ENV` | `development` / `production` / `test` |

#### Scripts
```bash
npm run dev     # tsx watch (hot reload)
npm run build   # tsc compile to dist/
npm run start   # node dist/index.js
```

---

### 3. voice-service

**Port:** `3001`  
**Stack:** NestJS 11, TypeScript, MongoDB (Mongoose), AWS S3, OpenAI Realtime API, Socket.io

#### Features
- **Book Management** — Upload PDF + cover image, stored in AWS S3; metadata in MongoDB
- **PDF Processing** — Extracts text segments from uploaded PDFs (`pdf2json`)
- **AI Voice Sessions** — Real-time voice chat using OpenAI Realtime API (`gpt-4o-mini-realtime-preview`)
  - Push-to-talk mode (manual `commit-audio`, `turn_detection: null`)
  - Whisper transcription for user speech
  - Context-aware responses grounded in the uploaded book content
  - Session history persisted to MongoDB

#### WebSocket Events (`/voice` namespace)
| Event (client → server) | Description |
|--------------------------|-------------|
| `start-session` | Begins a new voice session for a book |
| `send-audio` | Streams raw audio chunks to OpenAI |
| `commit-audio` | Signals end of user utterance, triggers AI response |
| `cancel-ai-response` | Interrupts AI mid-response |
| `end-session` | Closes the session and cleans up |

| Event (server → client) | Description |
|--------------------------|-------------|
| `session-ready` | Confirms session created, returns `sessionId` |
| `openai-event` | Forwards raw OpenAI Realtime events |
| `session-ended` | OpenAI connection closed |
| `error` | Error details |

#### REST Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/books` | Upload book (multipart: `pdf`, optional `cover`) |
| GET | `/api/books` | List books for user (header: `x-user-id`) |
| GET | `/api/books/:id` | Get book with pre-signed S3 URLs |
| DELETE | `/api/books/:id` | Delete book and S3 files |

#### Environment Variables (`.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Service port (default `3001`) |
| `OPENAI_API_KEY` | OpenAI API key for Realtime API |
| `MONGODB_URI` | MongoDB connection string |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_S3_BUCKET_NAME` | S3 bucket for PDF and cover storage |

#### Scripts
```bash
npm run start:dev    # NestJS watch mode
npm run build        # Compile to dist/
npm run start:prod   # node dist/main
npm test             # Jest unit tests
npm run test:e2e     # E2E tests
```

---

## Docker Compose

All three services can be started together:

```bash
docker compose up --build
```

| Service | Image | Port | Platform |
|---------|-------|------|----------|
| `backend` | `classroom-backend:latest` | `8000` | `linux/arm64` |
| `frontend` | `classroom-frontend:latest` | `5173` | `linux/arm64` |
| `voice-service` | `classroom-voice:latest` | `3001` | `linux/arm64` |

Each service reads its environment from its own `.env` file. The frontend waits for the backend to be ready (`depends_on: backend`).

---

## Local Development (without Docker)

```bash
# Backend
cd classroom-backend
npm install
npm run dev

# Frontend (separate terminal)
cd classroom-frontend
npm install
npm run dev

# Voice Service (separate terminal)
cd voice-service
npm install
npm run start:dev
```

---

## CORS Allowed Origins

| Service | Allowed Origins |
|---------|----------------|
| Backend | Configured via `FRONTEND_URL` env var (comma-separated) |
| Voice Service | `http://localhost:5173`, `https://classroom-nine-omega.vercel.app` |
