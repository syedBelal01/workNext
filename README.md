# WorkNest

Project and task tracker built to demonstrate role-based access control in a realistic team workflow.

Managers own delivery. Members update the work on their plate. Admins keep users and audit history in check.

## Stack

- **Frontend:** Next.js 14 (React.js, App Router, JavaScript)
- **Backend:** Node.js + Express (JavaScript)
- **Database:** SQLite via Prisma (Postgres-ready schema patterns, zero local DB install)
- **Auth:** JWT + bcrypt
- **Validation:** Zod
- **Extras:** Docker Compose, Vitest API tests, GitHub Actions CI, audit logging, pagination/search/filters

## Roles

| Capability | Admin | Manager | Member |
|---|---|---|---|
| Sign in / out | yes | yes | yes |
| Manage users | yes | no | no |
| View audit logs | yes | no | no |
| Create / edit / delete projects | yes | owned projects | no |
| View projects | all | member/owned | assigned only |
| Create tasks | yes | owned projects | on joined projects |
| Assign priority / reassign | yes | owned projects | no |
| Update task status | yes | owned projects | assigned tasks only |
| Delete tasks | yes | owned projects | no |

## Project layout

```
client/    Next.js UI
server/    Express API + Prisma
docker-compose.yml
.github/workflows/ci.yml
```

## Quick start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Install

```bash
cd server
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js

cd ../client
npm install
```

### 2. Run

Terminal A:

```bash
cd server
npm run dev
```

Terminal B:

```bash
cd client
npm run dev
```

- App: http://localhost:3000
- API: http://localhost:4000/api/health

### Environment

Copy examples if you want to tweak values:

- `server/.env`
- `client/.env.local`

Defaults already point the UI at `http://localhost:4000/api`.

## Test accounts

Password for all seeded users: `Password123!`

| Email | Role |
|---|---|
| admin@worknest.local | ADMIN |
| manager@worknest.local | MANAGER |
| member@worknest.local | MEMBER |
| dev@worknest.local | MEMBER |

## API overview

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/dashboard`
- `GET|POST /api/users` (admin)
- `PATCH|DELETE /api/users/:id` (admin)
- `GET|POST /api/projects`
- `GET|PATCH|DELETE /api/projects/:id`
- `GET /api/tasks`
- `POST /api/projects/:projectId/tasks`
- `PATCH|DELETE /api/tasks/:id`
- `GET /api/audit-logs` (admin)

List endpoints accept `page`, `limit`, `search`, and entity-specific filters (`status`, `priority`, `role`).

## Tests

```bash
cd server
npx prisma db push
node prisma/seed.js
npm test
```

Coverage focuses on the RBAC boundaries: forbidden routes, project visibility, and member update limits.

## Docker

```bash
docker compose up --build
```

This starts API on `:4000` and web on `:3000`.

## Design decisions

1. **SQLite for local setup** — assessment reviewers can clone and run without installing Postgres. The data model is still relational and Prisma-backed.
2. **Permission checks live on the API** — UI hides controls for clarity, but every mutation is enforced server-side.
3. **Managers own projects** — ownership scope avoids a free-for-all where every manager can edit every board.
4. **Members are write-limited** — they can progress assigned work (status/description) but cannot change priority, title, or assignees.
5. **Audit log is append-only activity history** — useful for admins reviewing login and mutation events.

## Deploy notes

For a public demo:

1. Host the API (Render / Railway / Fly) with a persistent volume for the SQLite file, or switch `DATABASE_URL` to Postgres and change the Prisma provider.
2. Host the Next.js app on Vercel and set `NEXT_PUBLIC_API_URL` to the public API URL.
3. Set a long random `JWT_SECRET` and update `CLIENT_ORIGIN` / CORS accordingly.

## License

MIT
