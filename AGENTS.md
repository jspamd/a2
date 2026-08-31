# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Despite the README mentioning a React frontend, this repository is a **backend-only** Node.js/Express REST API (the "OA办公自动化系统" / Office Automation system). There is no frontend to run. All functionality is exercised over HTTP against `http://localhost:3002/api/...`.

### Services
- **API server** (`npm run dev` for hot-reload via nodemon, or `npm start`). Listens on port `3002` (`PORT` in `.env`). It waits ~8 seconds after DB init before it actually starts listening — this is expected, wait for the `服务器运行在端口 3002` log line before hitting the API.
- **MySQL 8** — required datastore (`mysql2` + Sequelize, dialect hardcoded to `mysql`). Config comes from `.env` (`DB_HOST=localhost`, `DB_NAME=workflow`, `DB_USER=root`, `DB_PASSWORD=123456`).

### Starting MySQL (not auto-started on VM boot)
MySQL is installed in the VM snapshot but is **not** running after a fresh boot. Start it before running the app or the integration test scripts:
```bash
sudo mkdir -p /var/run/mysqld && sudo chown mysql:mysql /var/run/mysqld
sudo mysqld_safe &
```
The `root` password is already set to `123456` (matches `.env`). Connect with `mysql -uroot -p123456 -h127.0.0.1`.

### Database initialization
- The app **auto-creates tables and syncs models on startup** (`sequelize.sync({ force: false })`) and seeds the `admin` user, so you generally do **not** need a manual init step. Data persists across restarts.
- The `workflow` database itself must exist first. If it's missing, create it with `mysql -uroot -p123456 -h127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS workflow CHARACTER SET utf8mb4;"`. (`node init-db.js` is documented in the README but is currently **broken** — it treats the async `src/models` module as a resolved object — though it does drop/recreate the `workflow` DB before erroring.)

### Admin login gotcha (important)
Default admin is `admin` / `admin123`. The startup seeder creates the `admin` user and the `admin` role but does **not** link them. Because `checkRole` reads the role from the JWT (which is derived from the user's linked roles), admin's token has `role: null` and every admin-gated endpoint returns `403`. Run the provided maintenance script **once** to create the user↔role link, then log in again:
```bash
node fix-admin-role.js
```
After this, a fresh login token carries `role: admin` and admin-only endpoints (e.g. `POST /api/users`) work.

### Quick end-to-end smoke test
```bash
# health
curl -s http://localhost:3002/api/test
# login -> capture accessToken from data.accessToken
curl -s -X POST http://localhost:3002/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'
# create a user (admin token required)
curl -s -X POST http://localhost:3002/api/users -H 'Content-Type: application/json' -H "Authorization: Bearer <TOKEN>" -d '{"username":"zhangsan","password":"Test1234","name":"张三","email":"zhangsan@example.com"}'
```

### Lint / Test / Build
- **Lint**: `npm run lint` is **non-functional** — `eslint` is not a dependency and there is no ESLint config in the repo. Don't rely on it.
- **Test**: `npm test` (Jest, uses in-memory SQLite — no MySQL needed). The single suite `tests/workflow.test.js` currently **fails due to a pre-existing bug** in the test (it only loads the `workflow` + `user` models, but `User.associate` references the unloaded `Department` model, so `User.belongsTo(undefined)` throws). This is a repo bug, not an environment problem.
- **Build**: none — plain CommonJS Node.js, no transpile/bundle step.
- The many root-level `test-*.js` files are **not** Jest tests; they are standalone axios integration scripts that require the API server + MySQL to be running (e.g. `node test-base.js`).
