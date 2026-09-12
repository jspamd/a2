const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const SKIP_FILES = new Set(['index.js', 'registerModels.js']);

/**
 * Load every model file in this directory and wire associations.
 * Used by the app (MySQL) and by Jest (in-memory SQLite).
 */
function registerModels(sequelize, options = {}) {
  const logger = options.logger || {
    info() {},
    error() {}
  };

  const modelFiles = fs.readdirSync(__dirname).filter((file) => {
    return file.indexOf('.') !== 0 && !SKIP_FILES.has(file) && file.slice(-3) === '.js';
  });

  logger.info('找到以下模型文件:', modelFiles);

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
          if (Object.prototype.hasOwnProperty.call(model, modelName)) {
            logger.info(`注册模型: ${modelName}`);
            modelDefinitions[modelName] = model[modelName];
          }
        }
      } else if (typeof model === 'function') {
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

  logger.info('已加载的所有模型:', Object.keys(modelDefinitions));

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

  return modelDefinitions;
}

module.exports = { registerModels };
