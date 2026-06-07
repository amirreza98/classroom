# Classroom Management System

A microservices platform for managing classrooms, enrollments, real-time collaboration, analytics, notifications, and AI-powered voice reading assistance.

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
  │       ├── /api/auth/**         ──► auth-service      :8000  (no JWT check)
  │       ├── /api/users/**        ──► auth-service      :8000
  │       ├── /api/departments/**  ──► academic-service  :8001
  │       ├── /api/subjects/**     ──► academic-service  :8001
  │       ├── /api/classes/**      ──► academic-service  :8001
  │       ├── /api/enrollments/**  ──► academic-service  :8001
  │       ├── /api/payments/**     ──► academic-service  :8001
  │       ├── /api/dashboard/**    ──► academic-service  :8001
  │       ├── /api/stripe/**       ──► academic-service  :8001
  │       ├── /api/books/**        ──► voice-service     :3001
  │       ├── /api/voice/**        ──► voice-service     :3001
  │       ├── /api/analytics/**    ──► analytics-service :8081
  │       ├── /api/notifications/**──► notifications-service :8082
  │       └── /api/collaboration/**──► collaboration-service :8083
  │
  ├─ Voice WebSocket (Socket.IO)
  │    └── nginx :443  /  ──► voice-service :3001  (direct, no gateway)
  │
  └─ Collaboration WebSocket (STOMP/SockJS)
       └── nginx :443  /ws/ ──► collaboration-service :8083  (direct, no gateway)

Infrastructure
  Redis  :6379  — gateway rate-limit counters
  Kafka  :9092  — events between services  (topic: student.actions)
```

### Authentication flow

```
1.  POST /api/auth/sign-in/email
      → better-auth sets httpOnly session cookie

2.  GET /api/auth/token  (session cookie sent automatically)
      → better-auth returns a signed ES256 JWT (1 h TTL)

3.  Frontend caches JWT in memory (src/lib/token.ts)
    Refreshes proactively 60 s before expiry

4.  Every API request:  Authorization: Bearer <JWT>

5.  Gateway validates against JWKS (http://auth-service:8000/api/auth/jwks)
    Injects on success:
        X-User-Id    — JWT subject (user UUID)
        X-User-Role  — role claim  (admin | teacher | student)
        X-User-Email — email claim

6.  Downstream services read the three headers directly — no JWT library needed

7.  /api/auth/** bypasses JWT validation entirely
```

> **WebSocket connections** (Voice Socket.IO, Collaboration STOMP/SockJS) originate directly from the
> browser to their services via nginx. They do not pass through the gateway because browsers cannot
> set custom `Authorization` headers during the WebSocket upgrade handshake.

---

## Database layout (Neon PostgreSQL — single instance)

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

Cross-schema references (e.g. `academic.classes.teacher_id → auth.user.id`) are plain `TEXT` columns — no FK constraints across schemas to allow independent service deployment.

---

## Services

### gateway-service — port 8080

**Stack:** Spring Cloud Gateway, Spring Security OAuth2 Resource Server, Redis

| Responsibility | Detail |
|---|---|
| JWT validation | ES256, lazy-fetches JWKS from `auth-service:8000/api/auth/jwks` on first request |
| Header injection | `X-User-Id`, `X-User-Role`, `X-User-Email` on every forwarded request |
| Rate limiting | Redis fixed-window (1 min) per user — admin 300/min, teacher 120/min, student 60/min |
| Auth bypass | `/api/auth/**` skips JWT check entirely |
| Fail-open | Redis errors allow the request through rather than causing downtime |

**Route order** (first match wins):

| Path | Destination |
|---|---|
| `/api/auth/**` | auth-service :8000 (no JWT) |
| `/api/users/**` | auth-service :8000 |
| `/api/departments/**`, `/api/subjects/**`, `/api/classes/**` | academic-service :8001 |
| `/api/enrollments/**`, `/api/payments/**`, `/api/dashboard/**`, `/api/stripe/**` | academic-service :8001 |
| `/api/books/**`, `/api/voice/**` | voice-service :3001 |
| `/api/analytics/**` | analytics-service :8081 |
| `/api/notifications/**` | notifications-service :8082 |
| `/api/collaboration/**` | collaboration-service :8083 |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8080` | Listening port |
| `JWK_SET_URI` | `http://localhost:8000/api/auth/jwks` | better-auth JWKS endpoint |
| `AUTH_SERVICE_URL` | `http://localhost:8000` | auth-service |
| `ACADEMIC_SERVICE_URL` | `http://localhost:8001` | academic-service |
| `VOICE_SERVICE_URL` | `http://localhost:3001` | voice-service |
| `ANALYTICS_SERVICE_URL` | `http://localhost:8081` | analytics-service |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:8082` | notifications-service |
| `COLLABORATION_SERVICE_URL` | `http://localhost:8083` | collaboration-service |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

---

### auth-service — port 8000

**Stack:** Express 5, TypeScript, Drizzle ORM, PostgreSQL (`auth` schema, Neon), better-auth, Arcjet, KafkaJS, Site24x7 APM

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
| `*` | `/api/auth/*` | none | better-auth (sign-in, sign-up, GitHub OAuth, JWKS, token) |
| `GET` | `/api/users` | admin | List users with search/role filter |
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

Also blocks detected bots and shield-flagged requests. Returns 401 for any request without `X-User-*` gateway headers (`test` env excepted).

#### better-auth config

- Adapter: Drizzle (PostgreSQL, `auth` schema)
- Plugins: `jwt` (ES256, 1 h TTL, `role`/`email`/`name` claims)
- Social: GitHub OAuth
- Extra user fields: `role` (default `student`), `imageCldPubId`
- Kafka: publishes `student.actions / student.login` on session creation

**Environment variables**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `FRONTEND_URL` | Comma-separated CORS origins |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public base URL of this service |
| `ARCJET_KEY` | Arcjet API key |
| `KAFKA_BROKER` | Kafka broker address (default `localhost:9092`) |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
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
| `POST/PUT` | `/api/classes` | admin/teacher | Create/update classes |
| `DELETE` | `/api/classes/:id` | admin | Delete class |
| `GET` | `/api/enrollments` | any role | List enrollments (filter by classId or studentId) |
| `POST` | `/api/enrollments` | admin/teacher | Enroll student (no payment check) |
| `POST` | `/api/enrollments/self-enroll` | student | Self-enroll (Stripe checkout if paid) |
| `DELETE` | `/api/enrollments/:id` | admin/teacher | Unenroll student |
| `GET` | `/api/payments/my` | any | Own payment history |
| `GET` | `/api/payments` | admin | All payments (paginated) |
| `POST` | `/api/stripe/webhook` | none | Stripe event handler (marks enrollment paid) |
| `GET` | `/api/dashboard/stats` | admin/teacher | Aggregate counts |
| `GET` | `/api/dashboard/charts` | admin/teacher | Chart data |
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
| `FRONTEND_URL` | Used in Stripe checkout success/cancel URLs |
| `AUTH_SERVICE_URL` | Used for cross-service calls (default `http://localhost:8000`) |
| `KAFKA_BROKER` | Kafka broker address (default `localhost:9092`) |

**Scripts**

```bash
mvn spring-boot:run          # dev
mvn clean package -DskipTests
```

---

### voice-service — port 3001

**Stack:** NestJS 11, TypeScript, MongoDB (Mongoose), AWS S3, OpenAI Realtime API, Socket.IO

Handles PDF book uploads and real-time AI voice reading sessions.

#### REST endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/books` | Upload book (`multipart/form-data`: `pdf` required, `cover` optional) |
| `GET` | `/api/books` | List caller's books |
| `GET` | `/api/books/:id` | Get book with pre-signed S3 URLs |
| `DELETE` | `/api/books/:id` | Delete book and its S3 files |

#### WebSocket — Socket.IO namespace `/voice`

Direct browser connection via nginx.

| Event (client → server) | Payload | Description |
|---|---|---|
| `start-session` | `{ bookId, userId? }` | Opens OpenAI Realtime connection |
| `send-audio` | `{ audio: base64 }` | Streams audio chunk |
| `commit-audio` | — | Signals end of utterance |
| `cancel-ai-response` | — | Interrupts AI mid-response |
| `end-session` | `{ sessionId }` | Closes session |

**Environment variables**

| Variable | Description |
|---|---|
| `PORT` | Listening port (default `3001`) |
| `MONGO_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | AWS region |
| `AWS_S3_BUCKET_NAME` | S3 bucket for PDFs and covers |

**Scripts**

```bash
npm run start:dev
npm run build
npm run start:prod
```

---

### analytics-service — port 8081

**Stack:** Spring Boot 3, Java 21, Apache Kafka consumer

Consumes events from the `student.actions` Kafka topic.

#### Kafka consumer

| Topic | Group ID | Events consumed |
|---|---|---|
| `student.actions` | `analytics-group` | `class.created`, `student.enrolled`, `student.login` |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8081` | Listening port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |

---

### notifications-service — port 8082

**Stack:** Spring Boot 4, Java 21, Spring Data JPA, PostgreSQL

REST API for user notifications. All authorization via gateway-injected headers.

#### REST endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List notifications |
| `GET` | `/notifications/:id` | Get notification |
| `PATCH` | `/notifications/:id/read` | Mark as read |
| `POST` | `/notifications` | Create notification |
| `DELETE` | `/notifications/:id` | Delete notification |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8082` | Listening port |
| `DATABASE_URL` | _(required)_ | JDBC connection URL |
| `DATABASE_USERNAME` | `postgres` | DB username |
| `DATABASE_PASSWORD` | _(empty)_ | DB password |

---

### collaboration-service — port 8083

**Stack:** Spring Boot 3, Java 21, Spring WebSocket (STOMP + SockJS), PostgreSQL, Redis

Real-time collaborative document editing using Yjs CRDT.

#### WebSocket

```
STOMP over SockJS at /collaboration   (nginx: /ws/ → :8083)
```

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

**Stack:** React 19, TypeScript, Vite, Refine.dev v5, Shadcn/ui, Tailwind CSS v4, Recharts

#### Pages

| Route | Roles | Description |
|---|---|---|
| `/login` | — | Email/password + GitHub OAuth |
| `/register` | — | Create account |
| `/` | admin, teacher | Dashboard — 8 stat cards, 4 charts, activity feed |
| `/departments` | admin, teacher | Full CRUD |
| `/subjects` | admin, teacher | Full CRUD |
| `/classes` | all | List; admin/teacher: full CRUD + enrollments, invite code, capacity warning |
| `/users` | admin | Full CRUD + Cloudinary profile image upload |
| `/schedule` | all | Classes schedule view |
| `/schedule/class/:classId` | all | Collaborative editor (STOMP) |
| `/voice` | all | Voice library — upload books |
| `/voice/:bookId` | all | AI voice conversation (Socket.IO) |

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
npm run dev      # Vite dev server
npm run build    # Production build
```

---

## Infrastructure

### Redis — port 6379

- Gateway rate-limit counters (fixed-window, per-user key `rl:<userId>`)
- Pub/sub for collaboration service

### Kafka — port 9092

- Mode: KRaft (embedded, single-node)
- Topic: `student.actions`
  - Publishers: auth-service (login), academic-service (class.created, student.enrolled)
  - Consumer: analytics-service

### PostgreSQL (Neon — external, single instance, multiple schemas)

| Schema | Service | Tables |
|---|---|---|
| `auth` | auth-service | user, account, session, jwks, verification |
| `academic` | academic-service | departments, subjects, classes |
| `engagement` | academic-service | enrollments, payments |
| `management` | academic-service | grades, notifications |

### MongoDB (external)

| Service | Usage |
|---|---|
| voice-service | Book metadata, PDF segments, voice session history |

---

## Deployment

### EC2 — nginx reverse proxy

nginx routes:

| Path | Upstream |
|---|---|
| `/api/` | `localhost:8080` (gateway) |
| `/ws/` | `localhost:8083` (collaboration WebSocket) |
| `/` | `localhost:3001` (voice-service Socket.IO) |

### CI/CD — GitHub Actions (`.github/workflows/cd.yml`)

Push to `main` triggers selective builds — only services with changed files are rebuilt.

```
push to main
  │
  ├─ detect-changes  (paths-filter per service directory)
  │
  ├─ build-and-push-*  (parallel, only changed services)
  │     docker buildx  →  Docker Hub
  │     platforms: linux/amd64, linux/arm64
  │
  └─ deploy-to-ec2
        SCP docker-compose.yml → EC2
        SSH: sed build: → image: (Docker Hub tags)
            docker compose pull
            docker compose up -d --force-recreate
            docker exec auth-service npx drizzle-kit migrate
```

**Required GitHub secrets:** `DOCKER_USERNAME`, `DOCKER_TOKEN`, `EC2_HOST`, `EC2_SSH_KEY`

### Docker Compose

```bash
cp auth-service/.env.example     auth-service/.env
cp academic-service/.env.example academic-service/.env
cp voice-service/.env.example    voice-service/.env
# fill in secrets

docker compose up --build
```

| Container | Port | Depends on |
|---|---|---|
| `redis` | 6379 | — |
| `kafka` | 9092 | — |
| `auth-service` | 8000 | kafka, redis |
| `academic-service` | 8001 | kafka, redis, auth-service |
| `analytics-service` | 8081 | kafka |
| `notifications-service` | 8082 | — |
| `collaboration-service` | 8083 | redis |
| `voice-service` | 3001 | kafka |
| `gateway-service` | 8080 | redis, kafka, auth-service |

### Local development (no Docker)

```bash
# Start Redis and Kafka first, then:
cd auth-service              && npm install && npm run dev
cd academic-service          && mvn spring-boot:run
cd voice-service             && npm install && npm run start:dev
cd analytics-service         && ./mvnw spring-boot:run
cd notifications-service     && ./mvnw spring-boot:run
cd collaboration-service     && ./mvnw spring-boot:run
cd gateway-service           && ./mvnw spring-boot:run
cd classroom-frontend        && npm install && npm run dev
```

---

## Key design decisions

**Single-point JWT validation.** Only the gateway carries the `spring-security-oauth2` dependency. All downstream services read three plain HTTP headers. Swapping the auth provider means touching only the gateway.

**Auth / Academic split.** `auth-service` owns identity (user, session, JWT). `academic-service` owns all platform data (departments → classes → enrollments → payments → grades). Cross-service references are plain string IDs — no FK constraints across schemas.

**Same database, multiple schemas.** Both services share a single Neon PostgreSQL instance but use separate schemas (`auth`, `academic`, `engagement`, `management`). This gives schema-level isolation without the operational overhead of multiple databases.

**Non-fatal Kafka.** All services catch Kafka connection errors at startup and log a warning rather than crashing. Publish errors are fire-and-forget so a broker outage never blocks an HTTP response.

**Dual rate limiting.** Gateway enforces coarse Redis fixed-window limits per user. auth-service enforces finer Arcjet sliding-window limits with bot and shield detection on top.

**WebSocket bypass.** Browser WebSocket APIs cannot set custom `Authorization` headers on the upgrade handshake. Voice (Socket.IO) and Collaboration (STOMP/SockJS) connect directly via nginx.

**Selective CI builds.** GitHub Actions uses `paths-filter` to detect which service directories changed. Only changed services are rebuilt, keeping CI fast for single-service commits.
