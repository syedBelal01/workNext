# WorkNest

WorkNest is a full-stack project and task tracker with **role-based access control (RBAC)**.

Admins manage people and audit history.  
Managers own projects and assign work.  
Members update only the tasks assigned to them.

---

## Live demo

| Layer | URL |
|---|---|
| Frontend | https://work-next-client.vercel.app/ |
| API health | https://work-next-server.vercel.app/api/health |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, JavaScript |
| Backend | Node.js, Express, JavaScript |
| Database | **MongoDB Atlas** |
| ODM | **Mongoose** (schemas + queries) |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Tests | Vitest + Supertest |
| CI | GitHub Actions |
| Deploy | Vercel (client + server) |

**MongoDB vs Mongoose:** MongoDB stores the data. Mongoose is the Node library used to define models and talk to MongoDB from the API.

---

## Features

- Login / logout with JWT
- 3 roles: **ADMIN**, **MANAGER**, **MEMBER**
- Protected routes (UI + API)
- Project CRUD
- Task CRUD with assignee
- Members can update only **status** and **description** on assigned tasks
- Admin user management
- Admin audit log
- Search, filters, pagination
- Seed data for quick demo

---

## Who can do what

| Action | Admin | Manager | Member |
|---|---|---|---|
| Sign in / out | Yes | Yes | Yes |
| View dashboard | Yes | Yes | Yes |
| Manage users | Yes | No | No |
| View audit logs | Yes | No | No |
| Create projects | Yes | Yes | No |
| Edit / delete projects | All | Own only | No |
| View projects | All | Own / member / assigned | Own / member / assigned |
| View tasks | All | In accessible projects | **Assigned to them only** |
| Create tasks | Yes | Own projects | Joined projects (self-assign only) |
| Reassign / set priority | Yes | Own projects | No |
| Update task status | Yes | Own projects | Assigned tasks only |
| Delete tasks | Yes | Own projects | No |

Rules are enforced on the **API**. The UI only hides buttons for a cleaner experience.

---

## Repo structure

```text
worknest/
├── client/                 # Next.js frontend
├── server/                 # Express API + Mongoose
│   ├── seed.js             # demo data
│   ├── src/                # routes, controllers, models, rbac
│   └── tests/              # RBAC API tests
├── .github/workflows/      # CI
└── README.md
```

---

## Demo accounts

Password for **all** users:

```text
Password123!
```

| Email | Role |
|---|---|
| `admin@worknest.local` | ADMIN |
| `manager@worknest.local` | MANAGER |
| `member@worknest.local` | MEMBER |
| `dev@worknest.local` | MEMBER |

Seed also creates sample project **Customer Portal Revamp** with tasks.

---

## Local setup

### Requirements

- Node.js 18+ (20 recommended)
- npm 9+
- MongoDB Atlas cluster (free tier works)

### 1) Clone and install

```bash
git clone https://github.com/syedBelal01/workNext.git
cd workNext
npm install
```

### 2) Backend env

Create `server/.env`:

```env
DATABASE_URL="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/worknest?retryWrites=true&w=majority"
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=8h
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
NODE_ENV=development
```

In MongoDB Atlas → **Network Access**, allow your IP (or `0.0.0.0/0` for demo/deploy).

### 3) Frontend env

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 4) Database + seed

```bash
cd server
npm run db:seed
cd ..
```

### 5) Run app

From repo root:

```bash
npm run dev
```

Or two terminals:

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

Open:

- App → http://localhost:3000  
- API health → http://localhost:4000/api/health  

Login with any demo account above.

---

## Useful scripts

### Root

```bash
npm run dev          # API + web together
npm run build        # build both
npm test             # API tests
npm run db:seed      # seed MongoDB demo users/projects
```

### Server only

```bash
cd server
npm run dev
npm test
npm run db:seed
```

### Client only

```bash
cd client
npm run dev
npm run build
```

---

## API overview

Base URL (local): `http://localhost:4000/api`

| Method | Endpoint | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Auth |
| POST | `/auth/logout` | Auth |
| GET | `/dashboard` | Auth |
| GET / POST | `/users` | Admin |
| PATCH / DELETE | `/users/:id` | Admin |
| GET | `/users/assignable` | Admin, Manager |
| GET / POST | `/projects` | Auth / Admin+Manager |
| GET / PATCH / DELETE | `/projects/:id` | Scoped by role |
| GET | `/tasks` | Auth (members = assigned only) |
| POST | `/projects/:projectId/tasks` | Scoped by role |
| PATCH / DELETE | `/tasks/:id` | Scoped by role |
| GET | `/audit-logs` | Admin |

List APIs support `page`, `limit`, `search`, and filters like `status`, `priority`, `role`.

---

## Tests

```bash
cd server
npm run db:seed
npm test
```

What is covered:

- Invalid login rejected
- Members blocked from user list
- Admin can list users
- Members cannot create projects
- Manager can create project and invite member
- Members cannot change priority
- Members can update status on assigned tasks
- Audit logs are admin-only

CI runs the same checks on every push to `master` / `main`.

---

## Deploy on Vercel

You need **two** Vercel projects from the same GitHub repo.

### A) API (`server`)

1. Import repo → Root Directory = `server`
2. Environment variables:
   - `DATABASE_URL` = MongoDB Atlas URI
   - `JWT_SECRET` = long random secret
   - `CLIENT_ORIGIN` = your frontend URL (example: `https://your-app.vercel.app`)
3. Atlas Network Access → allow `0.0.0.0/0`
4. Deploy  
5. Check: `https://<api-domain>/api/health`

Current API example:  
`https://work-next-server.vercel.app/api/health`

### B) Frontend (`client`)

1. Import same repo → Root Directory = `client`
2. Environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://<api-domain>/api`
3. Deploy

Example:

```env
NEXT_PUBLIC_API_URL=https://work-next-server.vercel.app/api
```

---

## Design choices

1. **Server-side RBAC** — every protected action is checked in the API, not only in the UI.
2. **Manager ownership** — managers manage projects they own, not every project in the system.
3. **Member limits** — members progress assigned work (status/description) without changing priority, title, or assignee.
4. **Assign = access** — when a task is assigned, that user is added to the project and can see that work.
5. **MongoDB Atlas + Mongoose** — cloud MongoDB for storage; Mongoose models for the API.
6. **Audit log** — admins can review important activity.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Login fails / blank API | Confirm API is up (`/api/health`) and `NEXT_PUBLIC_API_URL` is correct |
| “One or more members are invalid” / session issues | Sign out and sign in again (old JWT after reseed) |
| DB connection errors | Check Atlas URI + Network Access (`0.0.0.0/0` for Vercel) |
| Assigned member cannot see task | Assign from project page; assignee should appear under Tasks after refresh |
| Mongo / connection errors in CI | CI starts a MongoDB replica set automatically |

---

## License

MIT
