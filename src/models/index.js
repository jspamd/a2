const Sequelize = require('sequelize');
const config = require('../config/database');
const { logger } = require('../utils/logger');
const { registerModels } = require('./registerModels');

const db = {};

// 初始化数据库连接和模型
async function initializeDatabase() {
  // 创建Sequelize实例
  let sequelize;
  try {
    logger.info('正在创建数据库连接...');
    logger.info('数据库配置:', {
      database: config.database,
      username: config.username,
      host: config.host,
      port: config.port,
      dialect: 'mysql'
    });
    
    sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        port: config.port,
        dialect: 'mysql',
        logging: config.logging,
        timezone: config.timezone,
        define: config.define
      }
    );
  } catch (error) {
    logger.error('创建数据库连接失败:', error);
    throw error;
  }

  // 测试数据库连接
  try {
    logger.info('正在测试数据库连接...');
    await sequelize.authenticate();
    logger.info('数据库连接测试成功');
  } catch (error) {
    logger.error('数据库连接测试失败:', error);
    throw error;
  }

  const modelDefinitions = registerModels(sequelize, { logger });
  Object.assign(db, modelDefinitions);

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;

  logger.info('数据库初始化完成，可用的模型:', Object.keys(db));
  return db;
}

// 导出一个函数，用于获取已初始化的数据库实例
module.exports = async () => {
  try {
    logger.info('正在获取数据库实例...');
    const db = await initializeDatabase();
    logger.info('成功获取数据库实例，可用的模型:', Object.keys(db));
    return db;
  } catch (error) {
    logger.error('获取数据库实例失败:', error);
    throw error;
  }
};