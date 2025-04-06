/**
 * 统一错误处理中间件
 */
const { logError, logWarn } = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'error' : 'fail';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 处理开发环境错误响应
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack
  });
};

// 处理生产环境错误响应
const sendErrorProd = (err, res) => {
  // 可操作的、已知的错误
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // 未知的错误，不向客户端泄露详情
    logError('未处理的错误', { error: err.message, stack: err.stack });
    res.status(500).json({
      status: 'error',
      message: '服务器内部错误'
    });
  }
};

// 处理Sequelize错误
const handleSequelizeValidationError = (err) => {
  const message = `数据验证失败: ${err.errors.map(item => item.message).join('. ')}`;
  return new AppError(message, 400);
};

const handleSequelizeUniqueConstraintError = (err) => {
  const message = `数据已存在: ${err.errors.map(item => item.message).join('. ')}`;
  return new AppError(message, 400);
};

const handleSequelizeForeignKeyConstraintError = (err) => {
  const message = '关联数据不存在或无法删除已关联的数据';
  return new AppError(message, 400);
};

// JWT相关错误
const handleJWTError = () => new AppError('无效的令牌，请重新登录', 401);
const handleJWTExpiredError = () => new AppError('令牌已过期，请重新登录', 401);

// 全局错误处理中间件
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // 记录错误日志
  if (err.statusCode >= 500) {
    logError('服务器错误', {
      url: req.originalUrl,
      method: req.method,
      message: err.message,
      stack: err.stack,
      user: req.user ? req.user.id : '未认证'
    });
  } else if (err.statusCode >= 400) {
    logWarn('客户端错误', {
      url: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode,
      message: err.message,
      user: req.user ? req.user.id : '未认证'
    });
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.stack = err.stack;

    // 处理Sequelize错误
    if (err.name === 'SequelizeValidationError') error = handleSequelizeValidationError(err);
    if (err.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueConstraintError(err);
    if (err.name === 'SequelizeForeignKeyConstraintError') error = handleSequelizeForeignKeyConstraintError(err);
    if (err.name === 'SequelizeError' || err.name === 'SequelizeDatabaseError') {
      error = new AppError(err.message || '数据库操作失败', 500);
    }

    // 处理JWT错误
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = {
  AppError,
  errorHandler
}; 