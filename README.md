# Classroom Management System

A production-grade microservices platform for managing classrooms, enrollments, real-time collaboration, analytics, notifications, and AI-powered voice reading assistance.

---

## Table of Contents

- [Features](#features)
- [Tech Stack Overview](#tech-stack-overview)
- [Architecture](#architecture)
- [Authentication Flow](#authentication-flow)
- [Database Layout](#database-layout)
- [Services](#services)
  - [gateway-service](#gateway-service--port-8080)
  - [auth-service](#auth-service--port-8000)
  - [academic-service](#academic-service--port-8001)
  - [voice-service](#voice-service--port-3001)
  - [analytics-service](#analytics-service--port-8081)
  - [notifications-service](#notifications-service--port-8082)
  - [collaboration-service](#collaboration-service--port-8083)
  - [classroom-frontend](#classroom-frontend--port-5173-dev--vercel-prod)
- [Infrastructure](#infrastructure)
- [Deployment](#deployment)
- [Key Design Decisions](#key-design-decisions)

---

## Features

- **Role-based access control** — admin, teacher, and student roles with per-role permissions and rate limits
- **GitHub OAuth & email authentication** — via `better-auth` with ES256 JWT, proactive token refresh
- **Department / Subject / Class management** — full CRUD with search, pagination, and Stripe-gated enrollment
- **Stripe payment integration** — self-enrollment triggers a Stripe Checkout session; webhook confirms payment
- **Real-time collaborative editing** — Yjs CRDT over STOMP/SockJS, Redis pub/sub for multi-instance broadcast
- **AI voice reading assistant** — upload PDF books, start a Socket.IO session, and converse with OpenAI Realtime
- **Event-driven analytics** — Kafka `student.actions` topic consumed by an isolated analytics service
- **User notifications** — REST API with role-scoped create/read/delete
- **Selective CI builds** — GitHub Actions only rebuilds services with changed files
- **Docker Compose + EC2 deployment** — tree-hash image caching prevents redundant Docker Hub pushes

---

## Tech Stack Overview

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Refine.dev v5, Shadcn/ui, Tailwind CSS v4, Recharts |
| API Gateway | Java 21, Spring Cloud Gateway, Spring Security OAuth2, Redis |
| Auth | Node.js, Express 5, TypeScript, better-auth, Drizzle ORM, Arcjet |
| Academic Core | Java 21, Spring Boot 3.3, Spring Data JPA, Flyway, Stripe, Kafka |
| Voice | NestJS 11, TypeScript, Mongoose, AWS S3, OpenAI Realtime API, Socket.IO |
| Analytics | Java 21, Spring Boot 3.3, Kafka consumer, PostgreSQL |
| Notifications | Java 21, Spring Boot 4.0, Spring Data JPA, PostgreSQL |
| Collaboration | Java 21, Spring Boot 3.3, STOMP/SockJS, PostgreSQL, Redis |
| Databases | Neon PostgreSQL (multi-schema), MongoDB (Atlas) |
| Message Bus | Apache Kafka (KRaft, single-node) |
| Cache / PubSub | Redis |
| Storage | AWS S3 (PDFs, book covers), Cloudinary (profile images) |
| CI/CD | GitHub Actions, Docker Hub, EC2 + nginx |

---

## Architecture

```
Browser
  │
  ├─ REST API (Authorization: Bearer <JWT>)
  │         │
  │    ┌────▼────────────────────────────────────────────────────┐
  │    │  gateway-service  :8080  (Spring Cloud Gateway)         │
  │    │  • Validates ES256 JWT against auth-service JWKS        │
  │    │  • Injects X-User-Id / X-User-Role / X-User-Email      │
  │    │  • Redis fixed-window rate limiting per user            │
  │    └──┬──────────────────────────────────────────────────────┘
  │       │
  │       ├── /api/auth/**          ──► auth-service        :8000  (no JWT check)
  │       ├── /api/users/**         ──► auth-service        :8000
  │       ├── /api/departments/**   ──► academic-service    :8001
  │       ├── /api/subjects/**      ──► academic-service    :8001
  │       ├── /api/classes/**       ──► academic-service    :8001
  │       ├── /api/enrollments/**   ──► academic-service    :8001
  │       ├── /api/payments/**      ──► academic-service    :8001
  │       ├── /api/dashboard/**     ──► academic-service    :8001
  │       ├── /api/stripe/**        ──► academic-service    :8001
  │       ├── /api/books/**         ──► voice-service       :3001
  │       ├── /api/voice/**         ──► voice-service       :3001
  │       ├── /api/analytics/**     ──► analytics-service   :8081
  │       ├── /api/notifications/** ──► notifications-service :8082
  │       └── /api/collaboration/** ──► collaboration-service :8083
  │
  ├─ Voice WebSocket (Socket.IO)
  │    └── nginx :443  /  ──► voice-service :3001  (direct, no gateway)
  │
  └─ Collaboration WebSocket (STOMP/SockJS)
       └── nginx :443  /ws/ ──► collaboration-service :8083  (direct, no gateway)

Async (Kafka topic: student.actions)
  auth-service       ──publishes──► student.login
  academic-service   ──publishes──► class.created, student.enrolled
  analytics-service  ──consumes──► all events  (group: analytics-group)

Infrastructure
  Redis  :6379  — gateway rate-limit counters, collaboration pub/sub
  Kafka  :9092  — event bus (KRaft mode)
```

---

## Authentication Flow

```
1.  POST /api/auth/sign-in/email  (or GitHub OAuth)
      → better-auth sets an httpOnly session cookie

2.  GET /api/auth/token  (session cookie sent automatically)
      → better-auth returns a signed ES256 JWT (1 h TTL)
      → claims: sub (user UUID), role, email, name

3.  Frontend caches JWT in memory (src/lib/token.ts)
    Refreshes proactively 60 s before expiry

4.  Every API request:  Authorization: Bearer <JWT>

5.  Gateway validates against JWKS fetched once from:
      http://auth-service:8000/api/auth/jwks
    On success, injects headers:
      X-User-Id    — JWT subject (user UUID)
      X-User-Role  — role claim  (admin | teacher | student)
      X-User-Email — email claim

6.  Downstream services read the three headers directly — no JWT library needed

7.  /api/auth/** bypasses JWT validation entirely
```

> **WebSocket connections** (Voice Socket.IO, Collaboration STOMP/SockJS) connect directly from the
> browser to their services via nginx — browsers cannot set custom `Authorization` headers during the
> WebSocket upgrade handshake, so the gateway is bypassed.

---

## Database Layout

### Neon PostgreSQL — single instance, multiple schemas

```
auth schema       ── auth-service owns
  user, account, session, jwks, verification

academic schema   ── academic-service owns
  departments, subjects, classes

engagement schema ── academic-service owns
  enrollments, payments

management schema ── academic-service owns
  grades, notifications
```

Cross-schema references (e.g. `classes.teacher_id → auth.user.id`) are plain `TEXT` columns — no FK constraints across schemas, which allows independent service deployment and migrations.

### MongoDB (Atlas) — voice-service owns

| Collection | Fields |
|---|---|
| `books` | title, author, userId, coverUrl, pdfUrl, createdAt |
| `voice_sessions` | bookId, userId, startedAt, endedAt |
| `segments` | bookId, pageNumber, content, index |

---

## Services

### gateway-service — port 8080

**Stack:** Java 21, Spring Cloud Gateway, Spring Security OAuth2 Resource Server, Redis

| Responsibility | Detail |
|---|---|
| JWT validation | ES256, lazily fetches JWKS from `auth-service:8000/api/auth/jwks` on first request |
| Header injection | `X-User-Id`, `X-User-Role`, `X-User-Email` on every forwarded request |
| Rate limiting | Redis fixed-window (1 min) per user — admin 300/min, teacher 120/min, student 60/min |
| Auth bypass | `/api/auth/**` skips JWT check entirely |
| Fail-open | Redis errors allow the request through rather than causing downtime |

**Route order** (first match wins):

| Path prefix | Destination |
|---|---|
| `/api/auth/**` | auth-service :8000 (no JWT) |
| `/api/users/**` | auth-service :8000 |
| `/api/departments/**`, `/api/subjects/**`, `/api/classes/**` | academic-service :8001 |
| `/api/enrollments/**`, `/api/payments/**`, `/api/dashboard/**`, `/api/stripe/**` | academic-service :8001 |
| `/api/books/**`, `/api/voice/**` | voice-service :3001 |
| `/api/analytics/**` | analytics-service :8081 |
| `/api/notifications/**` | notifications-service :8082 |
| `/ws/collaboration/**` | collaboration-service :8083 (path rewrite) |
| `/api/collaboration/**` | collaboration-service :8083 (prefix strip) |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8080` | Listening port |
| `JWK_SET_URI` | `http://localhost:8000/api/auth/jwks` | better-auth JWKS endpoint |
| `EXPRESS_SERVICE_URL` | `http://localhost:8000` | auth-service base URL |
| `ACADEMIC_SERVICE_URL` | `http://localhost:8001` | academic-service base URL |
| `VOICE_SERVICE_URL` | `http://localhost:3001` | voice-service base URL |
| `ANALYTICS_SERVICE_URL` | `http://localhost:8081` | analytics-service base URL |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:8082` | notifications-service base URL |
| `COLLABORATION_SERVICE_URL` | `http://localhost:8083` | collaboration-service base URL |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

---

### auth-service — port 8000

**Stack:** Express 5, TypeScript, Drizzle ORM, PostgreSQL (`auth` schema, Neon), better-auth, Arcjet, KafkaJS

Handles all authentication and user identity. Owns the `auth` schema.

#### Middleware chain (in order)

```
CORS
↓
X-Forwarded-Proto normalisation  (strips gateway-appended duplicate)
↓
better-auth handler  ← /api/auth/** handled here, never reaches below
↓
express.json()
↓
security middleware  (reads X-User-* headers → req.user, runs Arcjet)
↓
route handlers
```

#### REST endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `*` | `/api/auth/*` | none | better-auth — sign-in, sign-up, GitHub OAuth, JWKS, token |
| `GET` | `/api/users` | admin | List users with search / role filter (paginated) |
| `GET` | `/api/users/:id` | admin or own | Get user profile |
| `PUT` | `/api/users/:id` | admin or own | Update user profile |
| `DELETE` | `/api/users/:id` | admin | Delete user |

#### Arcjet rate limits (sliding window, 1-minute interval)

| Role | Requests/min |
|---|---|
| admin | 100 |
| teacher | 40 |
| student | 30 |
| guest | 15 |

Bot detection and Arcjet shield filtering are layered on top. Returns `401` for any request without `X-User-*` gateway headers (skipped in `test` env).

#### better-auth config

- Adapter: Drizzle (PostgreSQL, `auth` schema)
- Plugin: `jwt` (ES256, 1 h TTL, claims: `role`, `email`, `name`)
- Social: GitHub OAuth
- Extra user fields: `role` (default `student`), `imageCldPubId`
- Kafka: publishes `student.login` to `student.actions` topic on session creation

**Environment variables**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public base URL of this service |
| `FRONTEND_URL` | Comma-separated CORS origins |
| `ARCJET_KEY` | Arcjet API key |
| `KAFKA_BROKER` | Kafka broker address (default `localhost:9092`) |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `NODE_ENV` | `development` / `production` / `test` |

**Scripts**

```bash
npm run dev          # tsx watch (hot reload)
npm run build        # tsc → dist/
npm run start        # node dist/index.js
npm run db:generate  # Drizzle: generate migration files
npm run db:migrate   # Drizzle: apply migrations to auth schema
npm test             # vitest
```

---

### academic-service — port 8001

**Stack:** Java 21, Spring Boot 3.3, Spring Data JPA, PostgreSQL (`academic` / `engagement` / `management` schemas, Neon), Flyway, Spring Kafka, Stripe, Lombok

Core platform data. Owns the `academic`, `engagement`, and `management` schemas.

#### REST endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/departments` | any role | List departments (paginated, searchable) |
| `POST/PUT/DELETE` | `/api/departments` | admin | Manage departments |
| `GET` | `/api/subjects` | any role | List subjects (paginated, search + dept filter) |
| `POST/PUT/DELETE` | `/api/subjects` | admin | Manage subjects |
| `GET` | `/api/classes` | any role | List classes (paginated, search + subject/teacher filter) |
| `POST/PUT` | `/api/classes` | admin/teacher | Create / update classes |
| `DELETE` | `/api/classes/:id` | admin | Delete class |
| `GET` | `/api/enrollments` | any role | List enrollments (filter by classId or studentId) |
| `POST` | `/api/enrollments` | admin/teacher | Enroll student (no payment check) |
| `POST` | `/api/enrollments/self-enroll` | student | Self-enroll — triggers Stripe Checkout for paid classes |
| `DELETE` | `/api/enrollments/:id` | admin/teacher | Unenroll student |
| `GET` | `/api/payments/my` | any | Own payment history |
| `GET` | `/api/payments` | admin | All payments (paginated) |
| `POST` | `/api/stripe/webhook` | none | Stripe event handler — marks enrollment paid on success |
| `GET` | `/api/dashboard/stats` | admin/teacher | Aggregate stat counts |
| `GET` | `/api/dashboard/charts` | admin/teacher | Chart data for dashboard |
| `GET` | `/api/student-dashboard/overview` | student | Enrolled classes with details |

#### Kafka events published

| Topic | Event | Trigger |
|---|---|---|
| `student.actions` | `class.created` | New class created |
| `student.actions` | `student.enrolled` | Free enrollment or Stripe payment confirmed |

**Environment variables**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL JDBC connection string |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `FRONTEND_URL` | Used in Stripe checkout success/cancel redirect URLs |
| `AUTH_SERVICE_URL` | auth-service base URL (default `http://localhost:8000`) |
| `KAFKA_BROKER` | Kafka broker address (default `localhost:9092`) |

**Scripts**

```bash
mvn spring-boot:run
mvn clean package -DskipTests
```

---

### voice-service — port 3001

**Stack:** NestJS 11, TypeScript, MongoDB (Mongoose), AWS S3, OpenAI Realtime API, Socket.IO

Handles PDF book uploads, S3 storage, and real-time AI voice reading sessions.

#### REST endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/books` | Upload book (`multipart/form-data`: `pdf` required, `cover` optional) |
| `GET` | `/api/books` | List caller's books |
| `GET` | `/api/books/:id` | Get book with pre-signed S3 URLs |
| `DELETE` | `/api/books/:id` | Delete book and its S3 files |

#### WebSocket — Socket.IO namespace `/voice`

Direct browser connection via nginx (bypasses gateway). Auth is carried as query params or socket handshake data.

| Event (client → server) | Payload | Description |
|---|---|---|
| `start-session` | `{ bookId, userId? }` | Opens OpenAI Realtime connection, creates DB session |
| `send-audio` | `{ audio: base64 }` | Streams audio chunk to OpenAI |
| `commit-audio` | — | Signals end of utterance |
| `cancel-ai-response` | — | Interrupts AI mid-response |
| `end-session` | `{ sessionId }` | Closes session and persists end time |

| Event (server → client) | Description |
|---|---|
| `session-started` | Session confirmation with session ID |
| `message` | AI response chunk |
| `error` | Error message |

**Environment variables**

| Variable | Description |
|---|---|
| `PORT` | Listening port (default `3001`) |
| `MONGO_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | AWS region |
| `AWS_S3_BUCKET_NAME` | S3 bucket for PDFs and book covers |
| `KAFKA_BROKER` | Kafka broker address (reserved for future use) |

**Scripts**

```bash
npm run start:dev    # NestJS watch mode
npm run build
npm run start:prod
```

---

### analytics-service — port 8081

**Stack:** Java 21, Spring Boot 3.3, Spring Kafka consumer, Spring Data JPA, PostgreSQL

Consumes events from the `student.actions` Kafka topic and stores them for later querying.

#### Kafka consumer

| Topic | Group ID | Events consumed |
|---|---|---|
| `student.actions` | `analytics-group` | `class.created`, `student.enrolled`, `student.login` |

Auto offset reset: `earliest`

#### REST endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/analytics/health` | none | Service health check |
| `GET` | `/api/analytics/student/:studentId/stats` | any | Event counts grouped by type |
| `GET` | `/api/analytics/student/:studentId/recent` | any | Recent events (paginated, default limit 20) |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8081` | Listening port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |
| `DATABASE_URL` | _(required)_ | PostgreSQL JDBC URL |
| `DATABASE_USERNAME` | — | DB username |
| `DATABASE_PASSWORD` | — | DB password |

---

### notifications-service — port 8082

**Stack:** Java 21, Spring Boot 4.0, Spring Data JPA, PostgreSQL

REST API for user notifications. All authorization is derived from gateway-injected `X-User-*` headers.

#### REST endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | any | List — admin sees all, others see own (by email) |
| `GET` | `/api/notifications/:id` | admin or owner | Get notification |
| `PATCH` | `/api/notifications/:id/read` | admin or owner | Mark as read |
| `POST` | `/api/notifications` | any | Create — admin can target any recipient, others target self |
| `DELETE` | `/api/notifications/:id` | admin or owner | Delete notification |

**Notification entity fields:** id, recipientEmail, title, body, read, type, referenceId, createdAt

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8082` | Listening port |
| `DATABASE_URL` | _(required)_ | PostgreSQL JDBC URL |
| `DATABASE_USERNAME` | `postgres` | DB username |
| `DATABASE_PASSWORD` | _(empty)_ | DB password |

---

### collaboration-service — port 8083

**Stack:** Java 21, Spring Boot 3.3, Spring WebSocket (STOMP + SockJS), PostgreSQL, Redis

Real-time collaborative document editing using Yjs CRDT. Redis pub/sub enables state distribution across multiple service instances.

#### REST endpoints (file management)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/collaboration/classes/:classId/files` | List collaborative files for a class |
| `POST` | `/api/collaboration/classes/:classId/files` | Create file (body: `name`, `createdBy`) |
| `GET` | `/api/collaboration/files/:fileId/state` | Get current Yjs document state (binary) |
| `PUT` | `/api/collaboration/files/:fileId/state` | Persist Yjs document state (body: `state` array) |

#### WebSocket — STOMP over SockJS

Endpoint: `/collaboration` (nginx routes `/ws/` → `:8083`)

User identity is extracted from `X-User-*` headers during the SockJS handshake via `GatewayHandshakeInterceptor`.

| STOMP destination (client → server) | Description |
|---|---|
| `/app/collaboration/{classId}/{fileId}/sync` | Push a Yjs document update |

| STOMP topic (server → client) | Description |
|---|---|
| `/topic/collaboration/{classId}/{fileId}` | Broadcast update to all subscribers |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8083` | Listening port |
| `DATABASE_URL` | _(required)_ | PostgreSQL JDBC URL |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

---

### classroom-frontend — port 5173 (dev) / Vercel (prod)

**Stack:** React 19, TypeScript, Vite, Refine.dev v5, Shadcn/ui, Tailwind CSS v4, Recharts, Socket.IO client, STOMP

#### Pages

| Route | Roles | Description |
|---|---|---|
| `/login` | public | Email/password + GitHub OAuth |
| `/register` | public | Create account |
| `/` | admin, teacher | Dashboard — 8 stat cards, 4 charts, activity feed |
| `/departments` | admin, teacher | Full CRUD |
| `/subjects` | admin, teacher | Full CRUD |
| `/classes` | all | List; admin/teacher: full CRUD + enrollments, capacity warning |
| `/users` | admin | Full CRUD + Cloudinary profile image upload |
| `/schedule` | all | Classes schedule view |
| `/schedule/class/:classId` | all | Collaborative editor (Yjs + STOMP) |
| `/voice` | all | Voice library — list and upload PDF books |
| `/voice/:bookId` | all | AI voice conversation (Socket.IO → OpenAI Realtime) |
| `/profile` | all | Own profile with Cloudinary image upload |

#### Key frontend modules

| File | Purpose |
|---|---|
| `lib/auth-client.ts` | better-auth browser client setup |
| `lib/token.ts` | JWT caching in memory, proactive refresh 60 s before expiry |
| `lib/cloudinary.ts` | Cloudinary upload configuration |
| `lib/schema.ts` | Zod validation schemas for all forms |
| `components/auth-guard.tsx` | JWT-aware authentication provider |
| `components/role-guard.tsx` | Role-based route protection |
| `components/CollaborationEditor.tsx` | Yjs document bound to a STOMP subscription |
| `components/upload-widget.tsx` | Cloudinary unsigned upload widget |

**Environment variables**

| Variable | Description |
|---|---|
| `VITE_BACKEND_BASE_URL` | Gateway API base URL — **must end in `/api/`** |
| `VITE_VOICE_SERVICE_URL` | Voice service WebSocket URL |
| `VITE_COLLABORATION_URL` | Collaboration service WebSocket URL |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `VITE_CLOUDINARY_UPLOAD_URL` | Cloudinary upload endpoint |

**Scripts**

```bash
npm run dev      # Vite dev server (port 5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
npm run lint     # ESLint
```

---

## Infrastructure

### Redis — port 6379

- **Gateway:** Rate-limit counters (fixed-window, per-user key `rl:<userId>`)
- **Collaboration:** Pub/sub to broadcast Yjs document updates across service instances

### Kafka — port 9092

- Mode: KRaft (embedded, single-node, no ZooKeeper)
- Topic: `student.actions`

| Producer | Event |
|---|---|
| auth-service | `student.login` |
| academic-service | `class.created`, `student.enrolled` |

| Consumer | Group ID |
|---|---|
| analytics-service | `analytics-group` |

Event envelope: `{ event, studentId, classId?, subjectId?, metadata }`

All services catch Kafka errors at startup and on publish — Kafka is non-fatal; a broker outage never blocks an HTTP response.

### PostgreSQL (Neon — external, single instance, multiple schemas)

| Schema | Owned by | Tables |
|---|---|---|
| `auth` | auth-service | user, account, session, jwks, verification |
| `academic` | academic-service | departments, subjects, classes |
| `engagement` | academic-service | enrollments, payments |
| `management` | academic-service | grades, notifications |

### MongoDB (Atlas — external)

| Service | Usage |
|---|---|
| voice-service | Books, PDF segments, voice session history |

---

## Deployment

### Docker Compose

Copy and fill the required env files, then bring everything up:

```bash
cp auth-service/.env.example     auth-service/.env
cp voice-service/.env.example    voice-service/.env
# Set ACADEMIC_DATABASE_URL, COLLABORATION_DATABASE_URL, STRIPE_*, FRONTEND_URL in a root .env

docker compose up --build
```

| Container | Port | Depends on |
|---|---|---|
| `redis` | 6379 | — |
| `kafka` | 9092 | — |
| `auth-service` | 8000 | kafka, redis |
| `academic-service` | 8001 | kafka, redis, auth-service |
| `analytics-service` | 8081 | kafka |
| `notifications-service` | 8082 | kafka |
| `collaboration-service` | 8083 | redis |
| `voice-service` | 3001 | kafka |
| `gateway-service` | 8080 | redis, kafka, auth-service |

All containers run on the `classroom-network` bridge network.

### Local Development (without Docker)

Start Redis and Kafka first, then run each service:

```bash
cd auth-service          && npm install && npm run dev
cd academic-service      && mvn spring-boot:run
cd voice-service         && npm install && npm run start:dev
cd analytics-service     && ./mvnw spring-boot:run
cd notifications-service && ./mvnw spring-boot:run
cd collaboration-service && ./mvnw spring-boot:run
cd gateway-service       && ./mvnw spring-boot:run
cd classroom-frontend    && npm install && npm run dev
```

### EC2 — nginx reverse proxy

| nginx path | Upstream | Protocol |
|---|---|---|
| `/api/` | `localhost:8080` (gateway) | HTTP |
| `/ws/` | `localhost:8083` (collaboration) | WebSocket (STOMP/SockJS) |
| `/` | `localhost:3001` (voice) | HTTP + WebSocket (Socket.IO) |

### CI/CD — GitHub Actions

**CI** (`.github/workflows/ci.yml`) — runs on every push:

Uses `dorny/paths-filter` to detect which service directories changed, then runs only the relevant test jobs in parallel:

| Job | Runner | Services started |
|---|---|---|
| `ci-auth-service` | Node.js | vitest |
| `ci-academic-service` | Java 21 | PostgreSQL + Kafka |
| `ci-gateway` | Java 21 | Redis |
| `ci-voice` | Node.js | jest |
| `ci-analytics` | Java 21 | PostgreSQL + Kafka |
| `ci-notifications` | Java 21 | PostgreSQL |
| `ci-collaboration` | Java 21 | PostgreSQL + Redis |
| `ci-frontend` | Node.js | Vite build check |

**CD** (`.github/workflows/cd.yml`) — runs on push to `main`:

```
push to main
  │
  ├─ detect-changes  (paths-filter per service directory)
  │
  ├─ build-*  (parallel, only changed services)
  │     image cache key: git tree-hash of service directory
  │     docker buildx → Docker Hub
  │     platforms: linux/amd64, linux/arm64
  │
  └─ deploy-to-ec2
        SCP docker-compose.yml → EC2
        SSH:
          sed build: directives → image: tags
          docker compose pull
          docker compose up -d --force-recreate
          docker exec auth-service npx drizzle-kit migrate
```

**Required GitHub secrets:** `DOCKER_USERNAME`, `DOCKER_TOKEN`, `EC2_HOST`, `EC2_SSH_KEY`

---

## Key Design Decisions

**Single-point JWT validation.** Only the gateway carries `spring-security-oauth2`. All downstream services read three plain HTTP headers. Swapping the auth provider means touching only the gateway and auth-service.

**Auth / Academic split.** `auth-service` owns identity (user, session, JWT). `academic-service` owns all platform data (departments → classes → enrollments → payments → grades). Cross-service references are plain string IDs — no FK constraints across schemas.

**Same database, multiple schemas.** Both services share a single Neon PostgreSQL instance but use separate schemas. This gives schema-level isolation without the operational overhead of multiple database instances.

**Non-fatal Kafka.** All services catch Kafka connection errors at startup and log a warning rather than crashing. Publish errors are fire-and-forget so a broker outage never blocks an HTTP response.

**Dual rate limiting.** Gateway enforces coarse Redis fixed-window limits per user. auth-service enforces finer Arcjet sliding-window limits with bot detection and shield filtering on top.

**WebSocket bypass.** Browser WebSocket APIs cannot set custom `Authorization` headers on the upgrade handshake. Voice (Socket.IO) and Collaboration (STOMP/SockJS) connect directly via nginx.

**Selective CI/CD builds.** GitHub Actions uses `paths-filter` to detect which service directories changed. Image tags are keyed on the git tree-hash of each service directory — an unchanged service is never rebuilt or re-pushed.
