const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/database');
const { logger } = require('../utils/logger');

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

  // 导入所有模型
  const modelFiles = fs.readdirSync(__dirname)
    .filter(file => {
      return (file.indexOf('.') !== 0) && 
             (file !== 'index.js') && 
             (file.slice(-3) === '.js');
    });

  logger.info('找到以下模型文件:', modelFiles);

  // 首先加载所有模型
  const modelDefinitions = {};
  for (const file of modelFiles) {
    try {
      logger.info(`正在加载模型文件: ${file}`);
      const modelPath = path.join(__dirname, file);
      logger.info(`模型文件完整路径: ${modelPath}`);
      
      const modelModule = require(modelPath);
      const model = modelModule(sequelize, Sequelize.DataTypes);
      logger.info(`模型文件 ${file} 加载结果:`, model);
      
      if (typeof model === 'object') {
        for (const modelName in model) {
          if (model.hasOwnProperty(modelName)) {
            logger.info(`注册模型: ${modelName}`);
            modelDefinitions[modelName] = model[modelName];
          }
        }
      } else if (typeof model === 'function') {
        // 处理返回单个模型的情况
        const modelName = file.replace('.model.js', '');
        logger.info(`注册单个模型: ${modelName}`);
        modelDefinitions[modelName] = model;
      } else {
        logger.error(`模型文件 ${file} 返回值格式错误，期望是对象或函数，实际是 ${typeof model}`);
      }
    } catch (error) {
      logger.error(`加载模型文件 ${file} 失败:`, error);
      throw error;
    }
  }

  // 将所有模型添加到db对象中
  Object.assign(db, modelDefinitions);

  logger.info('已加载的所有模型:', Object.keys(db));

  // 然后设置所有模型的关联关系
  for (const modelName of Object.keys(modelDefinitions)) {
    try {
      if (modelDefinitions[modelName].associate) {
        logger.info(`设置模型关联: ${modelName}`);
        modelDefinitions[modelName].associate(modelDefinitions);
      }
    } catch (error) {
      logger.error(`设置模型 ${modelName} 关联关系失败:`, error);
      logger.error('错误详情:', error);
      logger.error('可用的模型:', Object.keys(modelDefinitions));
      throw error;
    }
  }

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