# AGENTS.md

Guidance for humans and Cursor Cloud agents working in this repository.

## What this repo is

This is a **backend-only** OA (office-automation) REST API: Node.js + Express + Sequelize + MySQL.

There is **no React frontend** in this repo, despite the README listing React + Ant Design. All behavior is exercised over HTTP at `http://localhost:<PORT>/api/...`.

| Item | Location / value |
| --- | --- |
| Entry | `start.js` → `src/app.js` |
| Listen port | `PORT` (default **3002**) |
| Startup delay | `src/app.js` sleeps **~8 seconds** after DB init, then `app.listen`. Wait for `服务器运行在端口 3002` before hitting the API. |
| Routes | `/api/auth`, `/api/users`, `/api/workflows`, `/api/monitor`, `/api/documents`, `/api/departments`, `/api/roles`, `/api/schedules`, `/api/announcements`, `/api/attendance` |
| Health check | `GET /api/test` |

## Configuration

Copy `.env.example` to `.env` and fill in local values. **Do not commit `.env` or paste secrets into this file.**

Env vars agents need by name (values live in `.env` / `.env.example`):

- App: `NODE_ENV`, `PORT`
- MySQL: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`

Dialect is hardcoded to `mysql`. The named database (`DB_NAME`) must exist before the current startup path can connect. `src/config/database.js` exports an unused `dbConnect()` helper that would `CREATE DATABASE IF NOT EXISTS`; `src/app.js` does **not** call it.

## How to start

Portable sequence (any machine):

1. Install Node deps: `npm install`
2. Start MySQL so it accepts TCP on `DB_HOST`:`DB_PORT`
3. Ensure the database named `DB_NAME` exists (utf8mb4). Example using env vars already loaded from `.env`:

```bash
mysql -u"$DB_USER" -p"$DB_PASSWORD" -h"$DB_HOST" -P"${DB_PORT:-3306}" \
  -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

4. Start the API: `npm run dev` (nodemon) or `npm start`
5. Wait ~8s+ for `服务器运行在端口 3002`

### Cursor Cloud VM (this environment)

MySQL is typically installed in the snapshot but **not** running after a fresh boot. systemd is often unavailable; prefer `service` or `mysqld_safe`.

```bash
# Prefer this when the mysql service unit works:
sudo service mysql start

# Fallback if the socket directory is missing / mysqld will not start:
sudo mkdir -p /var/run/mysqld && sudo chown mysql:mysql /var/run/mysqld
sudo mysqld_safe &
```

Unix socket under `/var/run/mysqld` may be unreadable to the non-root user. Use TCP for CLI checks (`-h 127.0.0.1`) rather than the default socket. The Node `mysql2` client using `DB_HOST=localhost` connects over TCP and is fine.

## Database initialization

- On startup the app **auto-syncs models** (`sequelize.sync({ force: false })`) and seeds a default admin user via `src/seeders/admin-user.js`. Data persists across restarts.
- **Do not run `node init-db.js`.** README documents it, but the script is **broken**: it `require('./src/models')` and then reads `.sequelize` on the result, while `src/models` exports an **async factory function**. It may drop/recreate `DB_NAME` and then throw `Cannot read properties of undefined (reading 'authenticate')`.
- Seeded admin username/password are documented in the README (“默认管理员账户”). Use those locally; do not copy them into commits or this file.

### Admin user ↔ admin role

The startup seeder (`src/seeders/admin-user.js`) is idempotent: it find-or-creates the `admin` user and `admin` role and inserts the `UserRoles` join row when missing. A fresh login token should carry `role: admin`, so admin-gated endpoints (including `POST /api/users`) work without a manual repair.

Databases that were seeded **before** this bind existed can still be repaired with:

```bash
node fix-admin-role.js
```

Then **log in again** so the new token carries `role: admin`. The script calls the same helper as the seeder.

## Smoke tests (placeholders only)

Replace angle-bracket placeholders. Do not put real passwords in the command history you commit or paste.

```bash
# health
curl -s "http://localhost:${PORT:-3002}/api/test"

# login — capture data.accessToken from the JSON body
curl -s -X POST "http://localhost:${PORT:-3002}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"<ADMIN_USER>","password":"<ADMIN_PASSWORD>"}'

# create a user (admin JWT required; token.role must be "admin")
curl -s -X POST "http://localhost:${PORT:-3002}/api/users" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"username":"zhangsan","password":"<NEW_USER_PASSWORD>","name":"张三","email":"zhangsan@example.com"}'
```

`POST /api/users` requires `username` (3–50, `[A-Za-z0-9_]`), `password` (min 6), `name`, and `email`.

## Lint / test / build caveats

These are pre-existing repo issues, not environment problems:

- **Lint**: `npm run lint` is non-functional. `eslint` is not a declared dependency and there is no `eslint.config.*` / `.eslintrc*` in the repo.
- **Jest**: `npm test` runs `tests/workflow.test.js` against in-memory SQLite (no MySQL needed). It **fails** because the suite only loads `workflow` + `user` models, while `User.associate` references the unloaded `Department` model (`User.belongsTo(undefined)`).
- **Ad-hoc scripts**: root-level `test-*.js` files (`test-login.js`, `test-base.js`, etc.) are standalone axios integration scripts, **not** Jest tests. Run them with `node test-login.js` only while the API + MySQL are up.
- **Build**: none. Plain CommonJS; no transpile/bundle step.

## Misc

On Unix startup the server may log a harmless `检查端口占用时发生错误: Command failed: lsof -i ...` when `lsof` is not installed. `killProcessOnPort` catches it and does **not** block listen.
