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
  │    │  • Validates ES256 JWT against backend JWKS             │
  │    │  • Injects X-User-Id / X-User-Role / X-User-Email      │
  │    │  • Redis fixed-window rate limiting per user            │
  │    └──┬──────────────────────────────────────────────────────┘
  │       │
  │       ├── /api/auth/**        ──► backend        :8000  (no JWT check)
  │       ├── /api/books/**       ──► voice-service  :3001
  │       ├── /api/voice/**       ──► voice-service  :3001
  │       ├── /api/analytics/**   ──► analytics      :8081
  │       ├── /api/notifications/**──► notifications :8082
  │       ├── /api/collaboration/**──► collaboration :8083
  │       └── /api/**             ──► backend        :8000  (catch-all)
  │
  ├─ Voice WebSocket (Socket.IO)
  │    └── nginx :443  /  ──► voice-service :3001  (direct, no gateway)
  │
  └─ Collaboration WebSocket (STOMP/SockJS)
       └── nginx :443  /ws/ ──► collaboration-service :8083  (direct, no gateway)

Infrastructure
  Redis  :6379  — gateway rate-limit counters
  Kafka  :9092  — backend → analytics  (topic: student.actions)
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

5.  Gateway validates against JWKS (http://backend:8000/api/auth/jwks)
    Injects on success:
        X-User-Id    — JWT subject (user UUID)
        X-User-Role  — role claim  (admin | teacher | student)
        X-User-Email — email claim

6.  Downstream services read the three headers directly — no JWT library needed

7.  /api/auth/** bypasses JWT validation entirely
```

> **WebSocket connections** (Voice Socket.IO, Collaboration STOMP/SockJS) originate directly from the
> browser to their services via nginx. They do not pass through the gateway because browsers cannot
> set custom `Authorization` headers during the WebSocket upgrade handshake. Voice passes `userId`
> in the message payload; Collaboration reads gateway headers from the HTTP upgrade request via
> `GatewayHandshakeInterceptor` (headers are added by nginx, not the gateway).

---

## Services

### gateway-service — port 8080

**Stack:** Spring Cloud Gateway, Spring Security OAuth2 Resource Server, Redis

| Responsibility | Detail |
|---|---|
| JWT validation | ES256, lazy-fetches JWKS from `backend:8000/api/auth/jwks` on first request |
| Header injection | `X-User-Id`, `X-User-Role`, `X-User-Email` on every forwarded request |
| Rate limiting | Redis fixed-window (1 min) per user — admin 300/min, teacher 120/min, student 60/min |
| Auth bypass | `/api/auth/**` skips JWT check entirely |
| Fail-open | Redis errors allow the request through rather than causing downtime |

**Route order** (first match wins):

| Path | Destination |
|---|---|
| `/api/auth/**` | backend :8000 (no JWT) |
| `/api/books/**` | voice-service :3001 |
| `/api/voice/**` | voice-service :3001 |
| `/api/analytics/**` | analytics-service :8081 |
| `/api/notifications/**` | notifications-service :8082 |
| `/api/collaboration/**` | collaboration-service :8083 |
| `/api/**` | backend :8000 (catch-all) |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8080` | Listening port |
| `JWK_SET_URI` | `http://localhost:8000/api/auth/jwks` | better-auth JWKS endpoint |
| `EXPRESS_SERVICE_URL` | `http://localhost:8000` | classroom-backend |
| `VOICE_SERVICE_URL` | `http://localhost:3001` | voice-service |
| `ANALYTICS_SERVICE_URL` | `http://localhost:8081` | analytics-service |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:8082` | notifications-service |
| `COLLABORATION_SERVICE_URL` | `http://localhost:8083` | collaboration-service |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

---

### classroom-backend — port 8000

**Stack:** Express 5, TypeScript, Drizzle ORM, PostgreSQL (Neon), better-auth, Arcjet, KafkaJS, Site24x7 APM

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
| `GET` | `/api/departments` | any role | List departments |
| `POST/PUT/DELETE` | `/api/departments` | admin/teacher | Manage departments |
| `GET` | `/api/subjects` | any role | List subjects |
| `POST/PUT/DELETE` | `/api/subjects` | admin/teacher | Manage subjects |
| `GET` | `/api/classes` | any role | List classes |
| `POST/PUT` | `/api/classes` | admin/teacher | Create/update classes |
| `DELETE` | `/api/classes/:id` | admin | Delete class |
| `GET` | `/api/users` | admin | List users |
| `GET/PUT` | `/api/users/:id` | admin or own | Get/update user |
| `DELETE` | `/api/users/:id` | admin | Delete user |
| `GET` | `/api/enrollments` | any role | List enrollments |
| `POST` | `/api/enrollments` | admin/teacher | Enroll student |
| `DELETE` | `/api/enrollments/:id` | admin/teacher | Unenroll student |
| `GET` | `/api/dashboard/stats` | admin/teacher | Stat card numbers |
| `GET` | `/api/dashboard/charts` | admin/teacher | Chart data + activity feed |
| `GET/POST/PUT/DELETE` | `/api/collaboration/**` | any role | Proxy to collaboration-service |

#### Security middleware (Arcjet)

Runs after gateway header injection. Role-based sliding-window rate limiting (1-minute interval):

| Role | Requests/min |
|---|---|
| admin | 100 |
| teacher | 40 |
| student | 30 |
| guest | 15 |

Also blocks detected bots and shield-flagged requests. Returns 401 for any request that arrives without `X-User-*` gateway headers (`test` env excepted).

#### Kafka producer

Publishes to `student.actions` topic on class creation. Non-fatal: backend starts and serves HTTP traffic even if Kafka is unreachable at startup. Publish errors are fire-and-forget.

#### better-auth config

- Adapter: Drizzle (PostgreSQL)
- Plugins: `jwt` (ES256, 1 h TTL, `role`/`email`/`name` claims)
- Social: GitHub OAuth
- Extra user fields: `role` (default `student`), `imageCldPubId`

**Environment variables**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `FRONTEND_URL` | Comma-separated CORS origins (must include the Vercel URL) |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public base URL of this service (used by better-auth for cookies/OAuth) |
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
npm run db:migrate   # Drizzle: apply migrations
```

---

### voice-service — port 3001

**Stack:** NestJS 11, TypeScript, MongoDB (Mongoose), AWS S3, OpenAI Realtime API, Socket.IO

Handles PDF book uploads and real-time AI voice reading sessions. User identity comes from the `x-user-id` header (injected during REST calls by the gateway; passed in message payload for WebSocket).

#### REST endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/books` | Upload book (`multipart/form-data`: `pdf` required, `cover` optional) |
| `GET` | `/api/books` | List caller's books (uses `x-user-id` header) |
| `GET` | `/api/books/:id` | Get book with pre-signed S3 URLs |
| `DELETE` | `/api/books/:id` | Delete book and its S3 files |

#### WebSocket — Socket.IO namespace `/voice`

Direct browser connection via nginx (`https://classroomnanegment.mooo.com/` → voice-service :3001).

| Event (client → server) | Payload | Description |
|---|---|---|
| `start-session` | `{ bookId, userId? }` | Opens OpenAI Realtime connection, loads book context |
| `send-audio` | `{ audio: base64 }` | Streams audio chunk to OpenAI |
| `commit-audio` | — | Signals end of utterance, triggers AI response |
| `cancel-ai-response` | — | Interrupts AI mid-response |
| `end-session` | `{ sessionId }` | Closes session and frees resources |

| Event (server → client) | Payload | Description |
|---|---|---|
| `session-ready` | `{ sessionId }` | Session created successfully |
| `openai-event` | raw OpenAI event | Forwarded OpenAI Realtime event |
| `session-ended` | — | OpenAI WebSocket closed |
| `error` | `{ message }` | Error details |

**Environment variables**

| Variable | Description |
|---|---|
| `PORT` | Listening port (default `3001`) |
| `MONGO_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key (Realtime API, `gpt-4o-mini-realtime-preview`) |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_S3_BUCKET_NAME` | S3 bucket for PDFs and covers |

**Scripts**

```bash
npm run start:dev   # NestJS watch mode
npm run build       # Compile to dist/
npm run start:prod  # node dist/main
npm test
npm run test:e2e
```

---

### analytics-service — port 8081

**Stack:** Spring Boot 3, Java 21, Apache Kafka consumer, Lombok

Consumes events from the `student.actions` Kafka topic. User identity available in HTTP handlers via `GatewayHeaderFilter` request attribute.

#### REST endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/analytics/health` | none | Health check |
| `GET` | `/api/analytics/events` | requires `X-User-Id` | Placeholder events list |

#### Kafka consumer

| Topic | Group ID | Description |
|---|---|---|
| `student.actions` | `analytics-group` | Receives `class.created` and other events from backend |

#### Reading gateway user in a controller

```java
GatewayUser user = (GatewayUser) request.getAttribute(GatewayHeaderFilter.GATEWAY_USER_ATTR);
// user.userId(), user.role(), user.email()
```

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8081` | Listening port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |

**Scripts**

```bash
./mvnw spring-boot:run
./mvnw clean package -DskipTests
```

---

### notifications-service — port 8082

**Stack:** Spring Boot 4, Java 21, Spring Data JPA, PostgreSQL

REST API for user notifications. All authorization is based on `X-User-Id`, `X-User-Role`, `X-User-Email` headers injected by the gateway.

#### REST endpoints

All endpoints require `X-User-Id` header (missing → 401).

| Method | Path | Admin | Non-admin | Description |
|---|---|---|---|---|
| `GET` | `/notifications` | All | Own (by `recipientEmail`) | List notifications |
| `GET` | `/notifications/:id` | Any | Own only | Get notification |
| `PATCH` | `/notifications/:id/read` | Any | Own only | Mark as read |
| `POST` | `/notifications` | Any `recipientEmail` | Forced to own email | Create notification |
| `DELETE` | `/notifications/:id` | Any | Own only | Delete notification |

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8082` | Listening port |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/notifications_db` | JDBC connection URL |
| `DATABASE_USERNAME` | `postgres` | DB username |
| `DATABASE_PASSWORD` | _(empty)_ | DB password |

**Scripts**

```bash
./mvnw spring-boot:run
./mvnw clean package -DskipTests
```

---

### collaboration-service — port 8083

**Stack:** Spring Boot 3, Java 21, Spring WebSocket (STOMP + SockJS), PostgreSQL (JPA), Redis

Real-time collaborative document editing using Yjs CRDT. Clients connect via STOMP over SockJS. Direct browser connection via nginx (`https://classroomnanegment.mooo.com/ws/` → collaboration-service :8083).

#### WebSocket

```
STOMP over SockJS at: /collaboration   (nginx: /ws/ → :8083)
```

| STOMP destination (client → server) | Payload | Description |
|---|---|---|
| `/app/collaboration/{classId}/{fileId}/sync` | `byte[]` Yjs update | Push a document update |

| STOMP topic (server → client) | Description |
|---|---|
| `/topic/collaboration/{classId}/{fileId}` | Broadcast Yjs update to all subscribers |

On subscription the service immediately sends the current Yjs state so the new client syncs without a round-trip.

#### User identity in STOMP handlers

`GatewayHandshakeInterceptor` copies `X-User-Id`, `X-User-Role`, `X-User-Email` from the HTTP upgrade request into WebSocket session attributes during the handshake.

```java
@MessageMapping("/collaboration/{classId}/{fileId}/sync")
public void handleSync(SimpMessageHeaderAccessor headers, ...) {
    String userId   = (String) headers.getSessionAttributes().get("userId");
    String userRole = (String) headers.getSessionAttributes().get("userRole");
}
```

**Environment variables**

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8083` | Listening port |
| `DATABASE_URL` | _(required)_ | PostgreSQL JDBC URL |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

**Scripts**

```bash
./mvnw spring-boot:run
./mvnw clean package -DskipTests
```

---

### classroom-frontend — port 5173 (dev) / Vercel (prod)

**Stack:** React 19, TypeScript, Vite, Refine.dev v5, Shadcn/ui, Tailwind CSS v4, Recharts

Deployed on **Vercel**. All REST API calls go through the gateway via Vercel's rewrite proxy.

#### Token management (`src/lib/token.ts`)

```
Login → session cookie set by better-auth
      → GET /api/auth/token (cookie sent, returns ES256 JWT)
      → JWT cached in memory
      → authHeader() returns { Authorization: Bearer <token> }
      → Auto-refreshed 60 s before expiry
      → Used on every REST call (data provider + raw fetch)
```

#### Pages

| Route | Roles | Description |
|---|---|---|
| `/login` | — | Email/password + GitHub OAuth |
| `/register` | — | Create account |
| `/` | admin, teacher | Dashboard — 8 stat cards, 4 charts, activity feed |
| `/departments` | admin, teacher | Full CRUD |
| `/subjects` | admin, teacher | Full CRUD |
| `/classes` | all | List; admin/teacher: full CRUD + enrollments, invite code, 80% capacity warning |
| `/users` | admin | Full CRUD + Cloudinary profile image upload |
| `/schedule` | all | Classes schedule view |
| `/schedule/class/:classId` | all | Collaborative editor (STOMP) |
| `/voice` | all | Voice library — upload books |
| `/voice/:bookId` | all | AI voice conversation (Socket.IO) |

#### Environment variables

| Variable | Description |
|---|---|
| `VITE_BACKEND_BASE_URL` | Gateway API base URL — **must end in `/api/`** (e.g. `http://host:8080/api/`) |
| `VITE_VOICE_SERVICE_URL` | Voice service URL for **WebSocket only** (e.g. `https://classroomnanegment.mooo.com`) |
| `VITE_COLLABORATION_URL` | Collaboration service URL for **WebSocket only** (e.g. `https://classroomnanegment.mooo.com`) |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `VITE_CLOUDINARY_UPLOAD_URL` | Cloudinary upload endpoint |

**Scripts**

```bash
npm run dev      # Vite dev server (proxy: /api → gateway)
npm run build    # Production build
npm run start    # Serve production build
```

---

## Infrastructure

### Redis — port 6379

- Gateway rate-limit counters (fixed-window, per-user key `rl:<userId>`)
- Optional pub/sub for collaboration service

### Kafka — port 9092

- Mode: KRaft (embedded, single-node)
- Topic: `student.actions` — published by backend on class creation, consumed by analytics-service
- Non-fatal: backend and voice-service start normally if Kafka is unavailable at startup

### PostgreSQL (Neon — external)

| Service | Usage |
|---|---|
| classroom-backend | Users, departments, subjects, classes, enrollments |
| collaboration-service | Yjs document state (`collaborative_files` table) |
| notifications-service | Notification records |

### MongoDB (external)

| Service | Usage |
|---|---|
| voice-service | Book metadata, PDF segments, voice session history |

---

## Deployment

### EC2 — nginx reverse proxy

nginx runs on port 443 (SSL, `classroomnanegment.mooo.com`) and routes:

| Path | Upstream | Notes |
|---|---|---|
| `/api/` | `localhost:8080` (gateway) | JWT validation, header injection |
| `/ws/` | `localhost:8083` (collaboration) | WebSocket upgrade for STOMP/SockJS |
| `/` | `localhost:3001` (voice-service) | WebSocket upgrade for Socket.IO |

### Vercel — frontend

`vercel.json` rewrites route all `/api/` calls from the Vercel deployment through to the EC2 gateway:

```json
{ "source": "/api/:path*", "destination": "http://<EC2_IP>:8080/api/:path*" }
```

Vercel env vars required: `VITE_BACKEND_BASE_URL=/api/` (relative — Vercel proxy handles the rest).

### CI/CD — GitHub Actions (`.github/workflows/deploy.yml`)

Push to `main` triggers a selective build: only services with changed files are rebuilt.

```
push to main
  │
  ├─ detect-changes (paths-filter per service directory)
  │
  ├─ build-and-push-* (parallel, only changed services)
  │     docker buildx  →  Docker Hub
  │     platforms: linux/amd64, linux/arm64
  │
  └─ deploy-to-ec2 (runs if any build succeeded)
        SCP docker-compose.yml → EC2
        SSH: sed build: → image: (Docker Hub tags)
            docker compose pull
            docker compose up -d --force-recreate
            docker exec backend npx drizzle-kit migrate
```

**Required GitHub secrets:** `DOCKER_USERNAME`, `DOCKER_TOKEN`, `EC2_HOST`, `EC2_SSH_KEY`

### Running with Docker Compose

```bash
cp classroom-backend/.env.example classroom-backend/.env
cp voice-service/.env.example     voice-service/.env
# fill in secrets

docker compose up --build
```

| Container | Port | Depends on |
|---|---|---|
| `redis` | 6379 | — |
| `kafka` | 9092 | — |
| `backend` | 8000 | kafka, redis |
| `analytics-service` | 8081 | kafka |
| `notifications-service` | 8082 | — |
| `collaboration-service` | 8083 | redis |
| `voice-service` | 3001 | kafka |
| `gateway-service` | 8080 | redis, kafka, backend |

> The frontend is not in Docker Compose — run it separately (`npm run dev`) or deploy to Vercel.

### Local development (no Docker)

```bash
# Start Redis and Kafka first, then:
cd classroom-backend       && npm install && npm run dev
cd voice-service           && npm install && npm run start:dev
cd analytics-service       && ./mvnw spring-boot:run
cd notifications-service   && ./mvnw spring-boot:run
cd collaboration-service   && ./mvnw spring-boot:run
cd gateway-service         && ./mvnw spring-boot:run
cd classroom-frontend      && npm install && npm run dev
```

---

## Key design decisions

**Single-point JWT validation.** Only the gateway carries the `spring-security-oauth2` dependency. Downstream services read three plain HTTP headers and have no JWT parsing code at all. Swapping the auth provider means touching only the gateway.

**Non-fatal Kafka.** Backend and voice-service catch Kafka connection errors at startup and log a warning rather than crashing. Publish errors inside route handlers are fire-and-forget so a broker outage never blocks an HTTP response.

**Dual rate limiting.** Gateway enforces coarse Redis fixed-window limits per user (300/120/60 per minute by role). Backend enforces finer Arcjet sliding-window limits (100/40/30 per minute) with bot and shield detection on top. Neither alone is enough.

**WebSocket connections bypass the gateway.** Browser WebSocket APIs cannot set custom `Authorization` headers on the upgrade handshake. Voice (Socket.IO) and Collaboration (STOMP/SockJS) connect directly via nginx. The gateway's role for those connections is limited to what nginx can forward in the HTTP upgrade request headers.

**Selective CI builds.** GitHub Actions uses `paths-filter` to detect which service directories changed. Only changed services are rebuilt and pushed, keeping CI fast for single-service commits. The deploy step always runs if any build succeeded and applies a rolling `force-recreate`.


neondb (source of truth — relations, access control)
├── Auth
│   ├── user
│   ├── account
│   ├── session
│   ├── jwks
│   └── verification
│
├── Academic
│   ├── departments
│   ├── subjects
│   └── classes
│
├── Engagement
│   ├── enrollments
│   └── payments
│
└── Management
    ├── grades (add)
    └── notifications (add)

MongoDB (content — high volume, flexible)
├── collaborative_files
├── subject_chat_messages
├── books
├── pdf_segments
└── voice_sessions

Redis
├── rate limiting (gateway — already working)
└── online presence (who is active)

S3
├── uploaded images (Cloudinary handles this currently)
├── voice audio files
└── PDF files