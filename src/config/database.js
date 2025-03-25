const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

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
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
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
    }
  }
);

// 数据库连接函数
const dbConnect = async () => {
  try {
    // 首先尝试创建数据库（如果不存在）
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    
    // 先创建不带数据库名的连接
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT || 3306,
      user: DB_USER,
      password: DB_PASSWORD
    });
    
    // 创建数据库（如果不存在）
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    
    console.log(`数据库 ${DB_NAME} 检查/创建完成`);
    
    // 关闭临时连接
    await connection.end();
    
    // 连接到指定数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 根据环境变量决定是否同步模型到数据库
    if (process.env.DB_SYNC === 'true') {
      console.log('正在同步数据库模型...');
      await sequelize.sync({ alter: true });
      console.log('数据库模型同步完成');
      
      // 初始化系统基础数据
      // 注意：这里需要延迟导入，因为models需要在sequelize初始化后才能导入
      try {
        // 先等待模型加载完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { initializeSystemData } = require('./initData');
        await initializeSystemData();
      } catch (initError) {
        console.warn('初始化系统数据时遇到问题:', initError.message);
        // 不阻止应用启动
      }
    }
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1); // 如果数据库连接失败，退出应用
  }
};

module.exports = dbConnect;
module.exports.sequelize = sequelize; 