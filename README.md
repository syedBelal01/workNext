# WorkNest

Project and task tracker built to demonstrate role-based access control in a realistic team workflow.

Managers own delivery. Members update the work on their plate. Admins keep users and audit history in check.

## Stack

- **Frontend:** Next.js 14 (React.js, App Router, JavaScript)
- **Backend:** Node.js + Express (JavaScript)
- **Database:** MongoDB Atlas via Prisma
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
- A MongoDB Atlas cluster (free tier is fine)

### 1. Configure env

Create `server/.env`:

```bash
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/worknest?retryWrites=true&w=majority"
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=8h
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
NODE_ENV=development
```

In Atlas, allow your IP (or `0.0.0.0/0` for demos/deployed APIs).

### 2. Install

```bash
cd server
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js

cd ../client
npm install
```

### 3. Run

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

1. **MongoDB Atlas** — cloud-hosted so local install is optional and Vercel serverless can share the same database.
2. **Permission checks live on the API** — UI hides controls for clarity, but every mutation is enforced server-side.
3. **Managers own projects** — ownership scope avoids a free-for-all where every manager can edit every board.
4. **Members are write-limited** — they can progress assigned work (status/description) but cannot change priority, title, or assignees.
5. **Audit log is append-only activity history** — useful for admins reviewing login and mutation events.

## Deploy notes

### API on Vercel (server folder)

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `server`.
3. Add environment variables:
   - `DATABASE_URL` = your MongoDB Atlas URI
   - `JWT_SECRET` = any long random string
   - `CLIENT_ORIGIN` = your frontend URL (e.g. `https://work-next.vercel.app`)
4. In Atlas Network Access, allow `0.0.0.0/0` (needed for Vercel).
5. Deploy. Health check: `https://<api-domain>/api/health`

### Frontend on Vercel (client folder)

1. New Vercel project from the same repo
2. Root Directory: `client`
3. Env: `NEXT_PUBLIC_API_URL` = `https://<api-domain>/api`
4. Deploy

### General

Set a strong `JWT_SECRET` for anything beyond local demos. Cors already allows `*.vercel.app` origins so previews work.

## License

MIT
