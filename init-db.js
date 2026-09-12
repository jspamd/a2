'use strict';

// Load env before any module that reads process.env (logger, models, DB config).
require('dotenv').config();

const mysql = require('mysql2/promise');
const { logger } = require('./src/utils/logger');

function parseForceFlag(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes('--force') || argv.includes('--reset')) {
    return true;
  }
  const value = env.INIT_DB_FORCE;
  return value === 'true' || value === '1' || value === 'yes';
}

async function ensureDatabase({ dropFirst = false } = {}) {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  if (!DB_NAME) {
    throw new Error('缺少环境变量 DB_NAME。请复制 .env.example 为 .env 并填写数据库配置。');
  }

  logger.info('正在连接 MySQL 服务器...', {
    host: DB_HOST,
    port: DB_PORT || 3306,
    database: DB_NAME
  });

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT || 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    connectTimeout: 60000,
    multipleStatements: true
  });

  try {
    if (dropFirst) {
      await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\`;`);
      logger.warn(`已删除数据库 ${DB_NAME}（--force / INIT_DB_FORCE）`);
    }

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    logger.info(`数据库 ${DB_NAME} 已就绪`);
  } finally {
    await connection.end();
  }
}

async function initializeDatabase(options = {}) {
  const force = options.force !== undefined ? options.force : parseForceFlag();
  const ensure = options.ensureDatabase || ensureDatabase;
  const loadModels = options.loadModels || (async () => require('./src/models')());
  const seed =
    options.seed ||
    (async () => {
      const { initializeSystemData } = require('./src/config/initData');
      await initializeSystemData();
    });

  if (force) {
    logger.warn('将以 force 模式重建数据库并同步模型（会清空现有数据）');
  }

  await ensure({ dropFirst: force });

  // src/models exports an async factory — same load path as src/app.js.
  const db = await loadModels();
  if (!db || !db.sequelize) {
    throw new Error('模型加载失败：src/models 是异步工厂，必须 await 后才能使用 sequelize');
  }

  await db.sequelize.authenticate();
  logger.info('数据库连接成功');

  logger.info('正在同步数据库模型...');
  await db.sequelize.sync({ force });
  logger.info('数据库模型同步完成');

  await seed();
  if (db.User && db.Role) {
    const { ensureAdminUserAndRole } = require('./src/seeders/admin-user');
    await ensureAdminUserAndRole(db);
  }
  logger.info('系统基础数据初始化完成');

  if (options.close !== false && db.sequelize.close) {
    await db.sequelize.close();
  }

  logger.info('数据库初始化完成');
  return db;
}

async function main() {
  try {
    await initializeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseForceFlag,
  ensureDatabase,
  initializeDatabase,
  main
};
