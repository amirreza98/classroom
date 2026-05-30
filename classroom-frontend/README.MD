# Classroom Frontend

A full-featured classroom management SPA built with **React 19 + TypeScript + Refine.dev**. Handles user management, class scheduling, real-time collaboration, and AI-powered voice conversations — all behind a role-based access system.

---

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run start      # serve production build
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19, TypeScript 5.8, Vite 6 |
| Admin framework | Refine.dev v5 (headless) |
| Routing | React Router 7 |
| UI Components | shadcn/ui (46 components) on Radix UI |
| Styling | Tailwind CSS v4 |
| Auth | BetterAuth (email/password + GitHub OAuth) |
| Data fetching | @refinedev/rest → Express backend |
| Tables | TanStack React Table v8 via @refinedev/react-table |
| Forms | react-hook-form + Zod |
| Charts | Recharts |
| Real-time | Yjs (CRDT) + STOMP over SockJS |
| Image upload | Cloudinary |
| Notifications | Sonner (toast) |
| Command palette | Refine Kbar |
| Icons | Lucide React |
| Date utils | date-fns, dayjs |

---

## Environment Variables

Create a `.env` file in this directory:

```env
# Backend REST API
VITE_BACKEND_BASE_URL=http://localhost:8000/api/

# Cloudinary (image uploads)
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_preset
VITE_CLOUDINARY_UPLOAD_URL=https://api.cloudinary.com/v1_1/<cloud>/image/upload

# Microservices
VITE_VOICE_SERVICE_URL=http://localhost:3001
VITE_COLLABORATION_URL=http://localhost:8083
```

---

## Project Structure

```
src/
├── App.tsx                      # Refine setup, all routes
├── pages/
│   ├── dashboard.tsx            # Stats cards + 4 charts + activity feed
│   ├── login.tsx                # Email/password + GitHub OAuth
│   ├── register.tsx
│   ├── classes/
│   │   ├── list.tsx             # Searchable, filterable table
│   │   ├── create.tsx
│   │   ├── edit.tsx
│   │   └── show.tsx             # Class details + enrollment management
│   ├── departments/
│   │   ├── list.tsx
│   │   ├── create.tsx
│   │   ├── edit.tsx
│   │   └── show.tsx
│   ├── subjects/
│   │   ├── list.tsx
│   │   ├── create.tsx
│   │   ├── edit.tsx
│   │   └── show.tsx
│   ├── users/
│   │   ├── list.tsx             # Admin-only
│   │   ├── create.tsx
│   │   ├── edit.tsx
│   │   └── show.tsx
│   └── voice/
│       ├── list.tsx             # AI voice library
│       └── conversation.tsx    # Live AI voice chat
├── components/
│   ├── CollaborationEditor.tsx  # Real-time Yjs editor
│   ├── upload-widget.tsx        # Cloudinary image picker
│   ├── auth-guard.tsx           # Session-based route guard
│   ├── role-guard.tsx           # Role-based route guard
│   ├── refine-ui/               # 30+ Refine-specific components
│   │   ├── layout/              # Layout, Header, Sidebar, Breadcrumb
│   │   ├── buttons/             # Create, Edit, Delete, Show, Clone, Refresh
│   │   ├── form/                # SignIn, SignUp, ForgotPassword forms
│   │   ├── data-table/          # TanStack Table wrapper
│   │   ├── views/               # ListView, CreateView, EditView, ShowView
│   │   ├── notification/        # Toaster, UndoableNotification
│   │   └── theme/               # ThemeProvider, ThemeToggle
│   └── ui/                      # 46 shadcn/ui primitives
├── hooks/
│   ├── useCollaboration.ts      # WebSocket + Yjs state
│   └── use-mobile.ts            # Responsive breakpoint
├── lib/
│   ├── auth-client.ts           # BetterAuth client
│   ├── schema.ts                # Zod validation schemas
│   ├── cloudinary.ts            # Cloudinary config
│   └── utils.ts                 # cn() helper
├── prodivers/
│   └── data.ts                  # Refine REST data provider
├── types/
│   └── index.ts                 # All TypeScript types
└── constants/
    └── index.ts                 # Roles, departments, upload limits
```

---

## Pages & Routes

### Public
| Route | Description |
|---|---|
| `/login` | Email/password and GitHub OAuth |
| `/register` | New account creation |

### Authenticated — All roles
| Route | Description |
|---|---|
| `/voice` | Browse AI voice books |
| `/voice/:bookId` | Live AI voice conversation |
| `/subjects` | Read-only subject browser |
| `/subjects/show/:id` | Subject detail |

### Authenticated — Teacher + Admin
| Route | Description |
|---|---|
| `/` | Dashboard with analytics |
| `/classes` | Classes list with filters |
| `/classes/create` | New class form |
| `/classes/edit/:id` | Update class |
| `/classes/show/:id` | Class detail + student enrollment |
| `/subjects/create` | New subject |
| `/subjects/edit/:id` | Update subject |
| `/departments` | Department list |
| `/departments/*` | Dept create / edit / show |

### Authenticated — Admin only
| Route | Description |
|---|---|
| `/users` | All users with role filter |
| `/users/create` | New user form |
| `/users/edit/:id` | Update user + role |
| `/users/show/:id` | Full user profile |

---

## Features

### Dashboard
- 8 stat cards: total users, classes, subjects, departments, active classes, students, teachers, enrollments
- 4 Recharts visualizations: enrollment trend, class status distribution, department breakdown, growth chart
- Recent activity feed

### Role-Based Access Control
Three roles with distinct permissions:

| Permission | student | teacher | admin |
|---|---|---|---|
| Dashboard | | Yes | Yes |
| Classes CRUD | | Yes | Yes |
| Subjects CRUD | | Yes | Yes |
| Departments CRUD | | Yes | Yes |
| Users CRUD | | | Yes |
| Voice & Subject list | Yes | Yes | Yes |

Route protection is layered: `AuthGuard` (session check) wraps `RoleGuard` (role check).

### CRUD Operations
Every resource (classes, subjects, departments, users) has:
- **List** — paginated, searchable, filterable data table
- **Create** — validated form with Zod schemas
- **Edit** — pre-filled form, PUT request
- **Show** — read-only detail view
- **Delete** — confirmation popover before deletion

### Class Management
- Assign subject, teacher, department
- Set capacity with 80% fill warning
- Manage class schedules
- Upload banner image via Cloudinary
- Generate and copy invite code to clipboard
- Enroll / unenroll students directly from the Show page

### Real-Time Collaborative Editor
Each class has a shared live editor powered by:
- **Yjs** (CRDT) — conflict-free concurrent edits
- **STOMP over SockJS** — WebSocket transport to the collaboration service
- Subscribes to `/topic/collaboration/{classId}`
- Publishes to `/app/collaboration/{classId}/sync`
- Live connection indicator (green = connected, red = disconnected)

### Authentication
- Email/password sign-in and registration
- GitHub OAuth via BetterAuth social provider
- Session managed via `useSession()` hook
- Automatic redirect to `/login` on session expiry
- User object fields: id, email, name, role, image, imageCldPubId

### Image Upload
- Cloudinary widget (`upload-widget.tsx`)
- Max file size: 3 MB
- Allowed formats: PNG, JPEG, JPG, WebP
- Returns both a URL and a Cloudinary public ID

### Theme
- Light / Dark / System via `next-themes`
- Toggle in header, persists across sessions

### Notifications & UX
- Toast notifications via Sonner
- Undoable delete actions (undo window)
- Command palette via Refine Kbar (`Ctrl+K`)
- Responsive layout with mobile sidebar drawer

---

## Data Layer

**File:** `src/prodivers/data.ts`

Built on `@refinedev/rest`. All CRUD maps to standard REST verbs against `VITE_BACKEND_BASE_URL`. Update requests use `PUT` (configured via `getRequestMethod: () => 'put'`). All requests include `credentials: "include"` for cookie-based auth.

**Custom filter params per resource:**

| Resource | Supported filters |
|---|---|
| classes | subject, teacher, name (search), status |
| subjects | department, name/code (search) |
| users | role, name/email (search) |
| departments | name (search) |
| enrollments | classId |

Pagination uses `?page=N&limit=N`. The backend returns `{ data: [...], pagination: { total, page, limit } }`.

---

## Key Types

```typescript
type UserRole = 'student' | 'teacher' | 'admin';

type User = {
  id: string; email: string; name: string;
  role: UserRole; image?: string; imageCldPubId?: string;
};

type ClassDetails = {
  id: number; name: string; description: string;
  status: 'active' | 'inactive' | 'archived';
  capacity: number; bannerUrl?: string;
  subject?: Subject; teacher?: User; department?: Department;
  schedules?: Schedule[]; inviteCode?: string;
};

type Subject    = { id: number; name: string; code: string; description: string; department?: Department };
type Department = { id: number; code: string; name: string; description?: string };
type Enrollment = { id: number; studentId: string; classId: number; student?: User };
```

---

## Validation Schemas (Zod)

| Schema | Fields |
|---|---|
| `userSchema` | name, email, role, image, imageCldPubId |
| `departmentSchema` | code, name, description |
| `subjectSchema` | name, code, description, departmentId |
| `classSchema` | name, description, status, capacity, subjectId, teacherId, bannerUrl, schedules |

---

## Vite Config

- Path alias: `@` → `src/`
- Dev server: `0.0.0.0:5173` (Docker-ready)
- API proxy: `/api/*` → backend (avoids CORS in dev)

---

## Scripts

```bash
npm run dev      # Vite dev server with HMR
npm run build    # Production build
npm run start    # Serve production build
npm run refine   # Refine CLI
```
