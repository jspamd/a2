const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { logger } = require('../utils/logger');

// 加载环境变量
dotenv.config();

// 创建 Sequelize 实例
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    logging: (msg) => logger.debug(msg),
    timezone: '+08:00',
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      timestamps: true,
      underscored: false,
      freezeTableName: false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      connectTimeout: 60000,
      supportBigNumbers: true,
      bigNumberStrings: true
    },
    retry: {
      max: 3,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  }
);

// 数据库连接函数
const dbConnect = async () => {
  try {
    // 首先尝试创建数据库（如果不存在）
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    
    logger.info('正在连接数据库...', { host: DB_HOST, port: DB_PORT, database: DB_NAME });
    
    // 先创建不带数据库名的连接
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT || 3306,
      user: DB_USER,
      password: DB_PASSWORD,
      connectTimeout: 60000,
      multipleStatements: true
    });
    
    logger.info('成功连接到MySQL服务器');
    
    // 创建数据库（如果不存在）
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    logger.info(`数据库 ${DB_NAME} 检查/创建完成`);
    
    // 关闭临时连接
    await connection.end();
    
    // 连接到指定数据库
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    
    // 根据环境变量决定是否同步模型到数据库
    if (process.env.DB_SYNC === 'true') {
      logger.info('正在同步数据库模型...');
      try {
        await sequelize.sync({ alter: true });
        logger.info('数据库模型同步完成');
        
        // 初始化系统基础数据
        try {
          // 先等待模型加载完成
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { initializeSystemData } = require('./initData');
          await initializeSystemData();
          logger.info('系统基础数据初始化完成');
        } catch (initError) {
          logger.warn('初始化系统数据时遇到问题:', initError.message);
          // 不阻止应用启动
        }
      } catch (syncError) {
        logger.error('数据库模型同步失败:', syncError);
        throw syncError;
      }
    }
    
    return sequelize;
  } catch (error) {
    logger.error('数据库连接失败:', error);
    throw error;
  }
};

module.exports = dbConnect;
module.exports.sequelize = sequelize; 