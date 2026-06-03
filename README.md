# Classroom Management System

A microservices platform for managing classrooms, enrollments, real-time collaboration, analytics, notifications, and AI-powered voice reading assistance.

---

## Architecture

All traffic from the frontend hits the **Spring Cloud Gateway** on port `8080`. The gateway is the only service that validates JWTs — it then stamps every forwarded request with three trusted headers (`X-User-Id`, `X-User-Role`, `X-User-Email`) that downstream services read directly, with no JWT re-validation.

```
Browser / Mobile
       │
       ▼
┌──────────────────────────────────┐
│  gateway-service  :8080          │  ← validates JWT, injects identity headers,
│  Spring Cloud Gateway            │    rate-limits per user role (Redis)
└──────────────────────────────────┘
       │
       ├──/api/auth/**──────────────► classroom-backend  :8000  (Express / better-auth, no JWT check)
       ├──/api/books/**─────────────► voice-service      :3001  (NestJS book REST API)
       ├──/api/voice/**─────────────► voice-service      :3001  (NestJS + OpenAI Realtime WebSocket)
       ├──/api/analytics/**─────────► analytics-service  :8081  (Spring Boot + Kafka consumer)
       ├──/api/notifications/**──────► notifications-service :8082 (Spring Boot REST)
       ├──/api/collaboration/**──────► collaboration-service :8083 (Spring Boot WebSocket/STOMP)
       └──/api/**───────────────────► classroom-backend  :8000  (CRUD REST API, catch-all)

Infrastructure
  Redis  :6379   — gateway rate-limit counters, collaboration pub/sub
  Kafka  :9092   — classroom-backend → analytics-service (topic: student.actions)
```

### Gateway authentication flow

```
1. User logs in via POST /api/auth/sign-in/email → better-auth sets an httpOnly session cookie
2. Frontend calls GET /api/auth/token (session cookie sent automatically)
   → better-auth returns a signed ES256 JWT (1 h TTL)
3. Frontend caches the JWT in memory (src/lib/token.ts); refreshes it 60 s before expiry
4. Every API request carries:  Authorization: Bearer <JWT>
5. gateway-service validates the token against the JWKS endpoint
   (http://backend:8000/api/auth/jwks, ES256)
6. On success, gateway injects:
      X-User-Id    — JWT subject (user's UUID)
      X-User-Role  — role claim  (admin | teacher | student)
      X-User-Email — email claim
7. Downstream service reads these three trusted headers — no JWT library needed
8. /api/auth/** routes bypass JWT validation entirely (login/register/OAuth callback)
```

> **Note — WebSocket connections**: Voice (Socket.IO) and Collaboration (STOMP/SockJS) WebSocket
> connections originate directly from the frontend to their respective services because browser
> WebSocket APIs cannot set arbitrary HTTP headers during the upgrade handshake. These connections
> pass the user's JWT in the STOMP `CONNECT` frame instead. Gateway-level JWT enforcement for
> WebSocket upgrade is a planned improvement.

---

## Services

### gateway-service — port 8080

**Stack:** Spring Cloud Gateway, Spring Security OAuth2 Resource Server, Redis

The single entry point for all API traffic.

| Responsibility | Detail |
|---|---|
| JWT validation | ES256, lazy-fetches JWKS from `backend:8000/api/auth/jwks` |
| Header injection | `X-User-Id`, `X-User-Role`, `X-User-Email` on every forwarded request |
| Rate limiting | Redis fixed-window per user: admin 300/min, teacher 120/min, student 60/min |
| Auth bypass | `/api/auth/**` skips JWT check entirely |

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
| `REDIS_PASSWORD` | _(empty)_ | Redis password |

---

### classroom-backend — port 8000

**Stack:** Express 5, TypeScript, Drizzle ORM, PostgreSQL (Neon), better-auth, Arcjet, Kafka (producer), Site24x7 APM

The main CRUD backend. Also hosts the better-auth endpoints that the gateway's JWKS check depends on.

#### API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `*` | `/api/auth/*` | none | better-auth (login, register, OAuth, JWKS) |
| `GET` | `/api/departments` | any role | List departments |
| `POST/PUT/DELETE` | `/api/departments` | admin/teacher | Manage departments |
| `GET` | `/api/subjects` | any role | List subjects |
| `POST/PUT/DELETE` | `/api/subjects` | admin/teacher | Manage subjects |
| `GET` | `/api/classes` | any role | List classes |
| `POST/PUT` | `/api/classes` | admin/teacher | Create/update classes |
| `DELETE` | `/api/classes/:id` | admin | Delete class |
| `GET` | `/api/users` | admin | List users |
| `GET` | `/api/users/:id` | admin or own | Get user |
| `PUT` | `/api/users/:id` | admin or own | Update user |
| `DELETE` | `/api/users/:id` | admin | Delete user |
| `GET` | `/api/enrollments` | any role | List enrollments |
| `POST` | `/api/enrollments` | admin/teacher | Enroll student |
| `DELETE` | `/api/enrollments/:id` | admin/teacher | Unenroll student |
| `GET` | `/api/dashboard/stats` | any role | Stat cards |
| `GET` | `/api/dashboard/charts` | any role | Chart data + activity |
| `GET/POST/PUT/DELETE` | `/api/collaboration` | any role | Collaboration file proxy |

#### Security middleware (Arcjet)

Runs after gateway header injection. Reads `req.user` populated from gateway headers, then applies role-based rate limiting (sliding window, 1-minute interval):

| Role | Requests/min |
|---|---|
| admin | 100 |
| teacher | 40 |
| student | 30 |
| guest | 15 |

Also blocks detected bots and shield-flagged requests. In `production`, requests that arrive without gateway headers are rejected with 401.

#### Kafka

Publishes to the `student.actions` topic on class creation. Kafka is **non-fatal** — if the broker is unavailable at startup the server starts normally and logs a warning. Publish errors inside routes are fire-and-forget (the HTTP response is never blocked).

#### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `FRONTEND_URL` | Comma-separated allowed CORS origins |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public base URL of this service |
| `ARCJET_KEY` | Arcjet API key |
| `KAFKA_BROKER` | Kafka broker address (default `localhost:9092`) |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `NODE_ENV` | `development` / `production` |

#### Scripts

```bash
npm run dev          # tsx watch (hot reload)
npm run build        # tsc → dist/
npm run start        # node dist/index.js
npm run db:generate  # Drizzle generate migrations
npm run db:migrate   # Apply migrations
```

---

### voice-service — port 3001

**Stack:** NestJS 11, TypeScript, MongoDB (Mongoose), AWS S3, OpenAI Realtime API, Socket.IO

Handles PDF book uploads and real-time AI voice reading sessions. User identity comes exclusively from the `x-user-id` header injected by the gateway — no JWT parsing in this service.

#### REST endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/books` | Upload book (`multipart/form-data`: `pdf` required, `cover` optional) |
| `GET` | `/api/books` | List caller's books (uses `x-user-id` header) |
| `GET` | `/api/books/:id` | Get book with pre-signed S3 URLs |
| `DELETE` | `/api/books/:id` | Delete book and its S3 files |

#### WebSocket — Socket.IO namespace `/voice`

Gateway forwards WebSocket upgrade connections including the `x-user-id`, `x-user-role`, `x-user-email` headers. The gateway reads `userId` from `client.handshake.headers['x-user-id']` first, with the message-payload `userId` as a fallback.

| Event (client → server) | Payload | Description |
|---|---|---|
| `start-session` | `{ bookId, userId? }` | Opens OpenAI Realtime connection, loads book context |
| `send-audio` | `{ audio: base64 }` | Streams audio chunk to OpenAI buffer |
| `commit-audio` | — | Signals end of utterance, triggers AI response |
| `cancel-ai-response` | — | Interrupts AI mid-response |
| `end-session` | `{ sessionId }` | Closes session and frees resources |

| Event (server → client) | Payload | Description |
|---|---|---|
| `session-ready` | `{ sessionId }` | Session created successfully |
| `openai-event` | raw OpenAI event | Forwarded OpenAI Realtime event |
| `session-ended` | — | OpenAI WebSocket closed |
| `error` | `{ message }` | Error details |

#### Environment variables

| Variable | Description |
|---|---|
| `PORT` | Listening port (default `3001`) |
| `MONGO_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key (Realtime API) |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_S3_BUCKET_NAME` | S3 bucket for PDFs and covers |

#### Scripts

```bash
npm run start:dev   # NestJS watch mode
npm run build       # Compile to dist/
npm run start:prod  # node dist/main
npm test            # Jest unit tests
npm run test:e2e    # E2E tests
```

---

### analytics-service — port 8081

**Stack:** Spring Boot 3, Java 21, Apache Kafka (consumer), Lombok

Consumes events from the `student.actions` Kafka topic produced by classroom-backend. No JWT validation — user identity is available from gateway headers in any HTTP handler via the `GatewayHeaderFilter` request attribute.

#### How to read gateway user in a controller

```java
@GetMapping("/something")
public ResponseEntity<?> example(HttpServletRequest request) {
    GatewayUser user = (GatewayUser) request.getAttribute(GatewayHeaderFilter.GATEWAY_USER_ATTR);
    // user.userId(), user.role(), user.email()
}
```

#### REST endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/analytics/health` | none | Health check |
| `GET` | `/api/analytics/events` | any (requires gateway headers) | Placeholder events list |

#### Kafka consumer

| Topic | Group ID | Description |
|---|---|---|
| `student.actions` | `analytics-group` | Receives `class.created` and other events |

#### Environment variables

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8081` | Listening port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |

#### Scripts

```bash
./mvnw spring-boot:run          # Run locally
./mvnw clean package -DskipTests # Build JAR
```

---

### notifications-service — port 8082

**Stack:** Spring Boot 4, Java 21, Spring Data JPA, PostgreSQL

REST API for user notifications. No JWT validation — all authorization is based on the `X-User-Id`, `X-User-Role`, `X-User-Email` headers injected by the gateway.

#### REST endpoints

All endpoints require `X-User-Id` header (injected by gateway). Missing header → `401`.

| Method | Path | Admin | Teacher/Student | Description |
|---|---|---|---|---|
| `GET` | `/notifications` | All notifications | Own (by `recipientEmail`) | List notifications |
| `GET` | `/notifications/:id` | Any | Own only | Get notification |
| `PATCH` | `/notifications/:id/read` | Any | Own only | Mark as read |
| `POST` | `/notifications` | Any `recipientEmail` | Forced to own email | Create notification |
| `DELETE` | `/notifications/:id` | Any | Own only | Delete notification |

#### Environment variables

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8082` | Listening port |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/notifications_db` | JDBC connection URL |
| `DATABASE_USERNAME` | `postgres` | DB username |
| `DATABASE_PASSWORD` | _(empty)_ | DB password |

#### Scripts

```bash
./mvnw spring-boot:run          # Run locally
./mvnw clean package -DskipTests # Build JAR
```

---

### collaboration-service — port 8083

**Stack:** Spring Boot 3, Java 21, Spring WebSocket (STOMP + SockJS), PostgreSQL (JPA), Redis

Real-time collaborative document editing using Yjs CRDT. Clients connect via STOMP over SockJS. Gateway headers are extracted from the HTTP upgrade handshake by `GatewayHandshakeInterceptor` and stored as WebSocket session attributes (`userId`, `userRole`, `userEmail`).

#### WebSocket endpoint

```
STOMP over SockJS at: /collaboration
```

| STOMP destination (client → server) | Description |
|---|---|
| `/app/collaboration/{classId}/{fileId}/sync` | Push a Yjs update binary |

| STOMP topic (server → client) | Description |
|---|---|
| `/topic/collaboration/{classId}/{fileId}` | Broadcast Yjs update to all subscribers |

On subscription, the service immediately sends the current Yjs state so the new client syncs without a round-trip.

#### How to read gateway user inside a STOMP handler

```java
@MessageMapping("/collaboration/{classId}/{fileId}/sync")
public void handleSync(SimpMessageHeaderAccessor headers, ...) {
    String userId    = (String) headers.getSessionAttributes().get("userId");
    String userRole  = (String) headers.getSessionAttributes().get("userRole");
    String userEmail = (String) headers.getSessionAttributes().get("userEmail");
}
```

#### Environment variables

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8083` | Listening port |
| `DATABASE_URL` | _(required)_ | PostgreSQL JDBC URL |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

#### Scripts

```bash
./mvnw spring-boot:run          # Run locally
./mvnw clean package -DskipTests # Build JAR
```

---

### classroom-frontend — port 5173

**Stack:** React 19, TypeScript, Vite, Refine.dev v5, Shadcn/ui, Tailwind CSS v4, Recharts

Single-page application. **All REST API calls go through the gateway** (`VITE_BACKEND_BASE_URL` = `http://<host>:8080/api/`). The frontend fetches a JWT from `GET /api/auth/token` after login, caches it in memory via `src/lib/token.ts`, and attaches it as `Authorization: Bearer <token>` on every request. The session cookie (httpOnly) is only used to refresh the JWT — it is never sent to API routes. Voice (Socket.IO) and Collaboration (STOMP/SockJS) WebSocket connections still originate directly to their services because browser WebSockets cannot send custom headers on the upgrade.

#### Pages

| Route | Description |
|---|---|
| `/login` | Email/password + GitHub OAuth |
| `/register` | Create account |
| `/` | Dashboard — 8 stat cards, 4 charts, activity feed |
| `/departments` | Full CRUD |
| `/subjects` | Full CRUD |
| `/classes` | Full CRUD + enrollment management, invite code, capacity warning at 80% |
| `/users` | Full CRUD + Cloudinary profile image upload |

#### Environment variables

| Variable | Description |
|---|---|
| `VITE_BACKEND_BASE_URL` | Gateway API base URL — **must point to gateway port 8080** (e.g. `http://localhost:8080/api/`) |
| `VITE_VOICE_SERVICE_URL` | Voice service direct URL for **WebSocket only** (e.g. `http://localhost:3001`) — REST book calls use `VITE_BACKEND_BASE_URL` |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `VITE_CLOUDINARY_UPLOAD_URL` | Cloudinary upload endpoint |

#### Scripts

```bash
npm run dev      # Vite dev server (via Refine CLI)
npm run build    # Production build
npm run start    # Serve production build
```

---

## Running the project

### With Docker Compose (recommended)

```bash
# Copy and fill in secrets first
cp classroom-backend/.env.example classroom-backend/.env
cp voice-service/.env.example     voice-service/.env

docker compose up --build
```

Services started by Docker Compose:

| Container | Port | Depends on |
|---|---|---|
| `redis` | 6379 | — |
| `kafka` | 9092 | — |
| `backend` | 8000 | kafka, redis |
| `analytics-service` | 8081 | kafka |
| `notifications-service` | 8082 | kafka |
| `collaboration-service` | 8083 | redis |
| `voice-service` | 3001 | kafka |
| `gateway-service` | 8080 | redis, kafka, backend |

> The frontend is not included in Docker Compose — run it separately or deploy to Vercel.

### Local development (no Docker)

Start Redis and Kafka locally first, then:

```bash
# classroom-backend
cd classroom-backend && npm install && npm run dev

# voice-service
cd voice-service && npm install && npm run start:dev

# analytics-service
cd analytics-service && ./mvnw spring-boot:run

# notifications-service
cd notifications-service && ./mvnw spring-boot:run

# collaboration-service
cd collaboration-service && ./mvnw spring-boot:run

# gateway-service
cd gateway-service && ./mvnw spring-boot:run

# classroom-frontend
cd classroom-frontend && npm install && npm run dev
```

---

## Key design decisions

**Gateway owns all auth.** Downstream services have no JWT dependency. They trust the three `X-*` headers unconditionally. This means you can swap the auth provider by updating only the gateway.

**Kafka is non-fatal.** classroom-backend starts and serves HTTP traffic even if Kafka is unavailable. Publish failures inside route handlers are logged and swallowed so the HTTP response is never delayed or broken by a broker outage.

**Role-based scoping in each service.** Even though the gateway validates the token, each downstream service enforces its own authorization rules using the injected role header — a compromised internal request can't escalate privileges without a matching role header.

**STOMP WebSocket session carries user identity.** The `GatewayHandshakeInterceptor` in collaboration-service copies gateway headers into WebSocket session attributes during the HTTP upgrade, so every STOMP message handler has access to the caller's identity without re-reading raw headers.
