const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { logger } = require('./src/utils/logger');
const db = require('./src/models');

// 加载环境变量
dotenv.config();

async function initializeDatabase() {
  try {
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
    
    // 删除数据库（如果存在）
    await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\`;`);
    logger.info(`数据库 ${DB_NAME} 已删除`);
    
    // 创建数据库
    await connection.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    logger.info(`数据库 ${DB_NAME} 创建完成`);
    
    // 关闭临时连接
    await connection.end();
    
    // 连接到指定数据库并同步模型
    await db.sequelize.authenticate();
    logger.info('数据库连接成功');
    
    // 同步所有模型到数据库
    logger.info('正在同步数据库模型...');
    await db.sequelize.sync({ force: true });
    logger.info('数据库模型同步完成');
    
    // 初始化系统基础数据
    try {
      // 增加等待时间确保模型加载完成
      await new Promise(resolve => setTimeout(resolve, 3000));
      const { initializeSystemData } = require('./src/config/initData');
      await initializeSystemData();
      logger.info('系统基础数据初始化完成');
    } catch (initError) {
      logger.warn('初始化系统数据时遇到问题:', initError.message);
    }
    
    // 关闭数据库连接
    await db.sequelize.close();
    logger.info('数据库初始化完成');
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 运行初始化
initializeDatabase(); 