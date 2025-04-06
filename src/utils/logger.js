const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;
const path = require('path');
const fs = require('fs');
const os = require('os');

// 创建日志目录（如果不存在）
const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// 定义自定义格式
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    metaStr = JSON.stringify(metadata);
  }
  return `[${timestamp}] [${level}] ${message} ${metaStr}`;
});

// 创建 Winston 日志对象
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'oa-system' },
  transports: [
    // 写入所有日志到 combined.log
    new transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      encoding: 'utf8'
    }),
    // 单独写入错误日志到 error.log
    new transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      encoding: 'utf8'
    }),
  ],
  exceptionHandlers: [
    new transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      encoding: 'utf8'
    })
  ],
  rejectionHandlers: [
    new transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      encoding: 'utf8'
    })
  ]
});

// 在开发环境中，同时输出到控制台
if (process.env.NODE_ENV !== 'production') {
  // 创建简单的控制台传输
  const consoleTransport = new transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      printf(({ level, message, timestamp }) => {
        return `[${timestamp}] [${level}] ${message}`;
      })
    )
  });
  
  logger.add(consoleTransport);
}

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const start = new Date();
  
  // 当响应结束时记录请求信息
  res.on('finish', () => {
    const duration = new Date() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: duration + 'ms',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    // 如果已认证，记录用户ID
    if (req.user && req.user.id) {
      logData.userId = req.user.id;
    }
    
    // 根据状态码记录不同级别的日志
    if (res.statusCode >= 500) {
      logger.error('Request error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
};

// 日志级别辅助函数
const logError = (message, meta = {}) => {
  logger.error(message, meta);
};

const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

// 导出
module.exports = {
  logger,
  requestLogger,
  logError,
  logWarn,
  logInfo,
  logDebug
}; 