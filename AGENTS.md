# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
A backend-only **OA / office-automation REST API** (Node.js + Express + Sequelize on MySQL). There is **no frontend** in this repo despite the README mentioning React. All code lives under `src/` and is served as `/api/*` routes. Entry point: `start.js` → `src/app.js`, listening on `PORT` (default **3002**).

### Services required to run
- **MySQL** (server is preinstalled in the environment). Start it each session with `sudo service mysql start` (systemd is not running in this VM, so use the `service` command, not `systemctl`).
  - The `root` user password is `123456` and DB name is `workflow`, matching `.env`.
  - The unix socket under `/var/run/mysqld` has restricted permissions for the non-root user, so connect over TCP for CLI checks: `mysql -uroot -p123456 -h 127.0.0.1 -P 3306`. The app connects fine via `host=localhost` (mysql2 uses TCP).
- **The API server**: `npm run dev` (nodemon) after MySQL is up. Note `src/app.js` intentionally `sleep`s ~8 seconds before `app.listen`, so startup takes ~8s+; wait for the log line `服务器运行在端口 3002` before hitting the API.

### Database initialization
- You do **not** need `node init-db.js`. That script is broken (it does `require('./src/models').sequelize` but the models module exports an async factory function, so it throws `Cannot read properties of undefined (reading 'authenticate')` after creating the DB).
- The app **self-initializes** on startup: it creates the `workflow` DB if missing, syncs all models (creates ~29 tables), and seeds the default admin. Default admin credentials: **`admin` / `admin123`**.

### Lint / test caveats (pre-existing, not environment issues)
- `npm run lint` does **not** work out of the box: `eslint` is not a declared dependency and there is no `eslint.config.*` / `.eslintrc*` file in the repo.
- `npm test` (Jest, `tests/workflow.test.js`) currently **fails** due to a bug in the test itself: it loads only a subset of models, so `User.associate` references an undefined `models.Department` (`... not a subclass of Sequelize.Model`). This is independent of MySQL (the test uses in-memory sqlite).
- The root-level `test-*.js` files (e.g. `test-login.js`, `test-base.js`) are **ad-hoc axios integration scripts**, not Jest tests. Run them with `node test-login.js` while the server + MySQL are running.

### Misc
- The server logs a harmless error `检查端口占用时发生错误: Command failed: lsof -i ...` on startup because `lsof` is not installed; it is caught and does not block startup.
