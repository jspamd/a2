const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

// 环境变量配置
dotenv.config();

// 日志和监控
const { logger, requestLogger } = require('./utils/logger');
const { monitorMiddleware } = require('./utils/monitor');

// 检查依赖
const { checkAndInstallDependencies } = require('./utils/checkDependencies');

// 数据库连接
const dbConnect = require('./config/database');

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(requestLogger);
app.use(monitorMiddleware);

// 限速配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP限制1000次请求
  message: { status: 'error', message: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 创建必要的目录
const createRequiredDirectories = async () => {
  const directories = [
    process.env.UPLOAD_PATH || 'uploads',
    path.join(process.env.UPLOAD_PATH || 'uploads', 'temp'),
    path.join(process.env.UPLOAD_PATH || 'uploads', 'documents'),
    'logs'
  ];

  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
        logger.info(`创建目录成功: ${dir}`);
      }
    } catch (error) {
      logger.error(`创建目录失败: ${dir}`, error);
      throw error;
    }
  }
};

// 启动应用
async function startApp() {
  let server;
  try {
    logger.info('正在启动应用...');
    
    // 创建必要的目录
    await createRequiredDirectories();
    
    // 检查依赖
    logger.info('正在检查依赖...');
    const dependenciesReady = await checkAndInstallDependencies();
    if (!dependenciesReady) {
      throw new Error('缺少必要依赖，无法启动应用');
    }
    
    // 连接数据库
    logger.info('正在连接数据库...');
    await dbConnect();
    logger.info('数据库连接成功');
    
    // 加载路由
    logger.info('正在加载路由...');
    const authRoutes = require('./routes/auth.routes');
    const userRoutes = require('./routes/user.routes');
    const roleRoutes = require('./routes/role.routes');
    const departmentRoutes = require('./routes/department.routes');
    const announcementRoutes = require('./routes/announcement.routes');
    const scheduleRoutes = require('./routes/schedule.routes');
    const workflowRoutes = require('./routes/workflow.routes');
    const monitorRoutes = require('./routes/monitor.routes');
    const documentRoutes = require('./routes/document.routes');
    
    // 注册路由
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/roles', roleRoutes);
    app.use('/api/departments', departmentRoutes);
    app.use('/api/announcements', announcementRoutes);
    app.use('/api/schedules', scheduleRoutes);
    app.use('/api/workflows', workflowRoutes);
    app.use('/api/monitor', monitorRoutes);
    app.use('/api/documents', documentRoutes);
    
    // 404错误处理
    app.use((req, res, next) => {
      logger.warn('未找到请求的资源', { url: req.originalUrl });
      res.status(404).json({
        status: 'error',
        message: '未找到请求的资源'
      });
    });
    
    // 错误处理中间件
    const { errorHandler } = require('./middleware/errorHandler');
    app.use(errorHandler);
    
    // 启动服务器
    server = app.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
      console.log(`服务器运行在端口 ${PORT}`);
    });
    
    // 处理服务器错误
    server.on('error', (error) => {
      logger.error('服务器错误', { error: error.message });
      if (error.code === 'EADDRINUSE') {
        logger.error(`端口 ${PORT} 已被占用`);
      }
      gracefulShutdown(error);
    });
    
  } catch (error) {
    logger.error('启动应用失败', { error: error.message, stack: error.stack });
    console.error('启动应用失败:', error);
    process.exit(1);
  }
  
  return server;
}

// 优雅关闭函数
async function gracefulShutdown(error) {
  logger.info('开始优雅关闭服务...');
  
  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
      logger.info('HTTP服务器已关闭');
    }
    
    // 关闭数据库连接
    if (dbConnect.sequelize) {
      await dbConnect.sequelize.close();
      logger.info('数据库连接已关闭');
    }
    
  } catch (shutdownError) {
    logger.error('关闭服务时发生错误', shutdownError);
  } finally {
    if (error) {
      logger.error('服务异常终止', error);
      process.exit(1);
    } else {
      logger.info('服务正常关闭');
      process.exit(0);
    }
  }
}

// 监听进程信号
process.on('SIGTERM', () => gracefulShutdown());
process.on('SIGINT', () => gracefulShutdown());

// 监听未捕获的异常和拒绝
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常', { error: err.message, stack: err.stack });
  gracefulShutdown(err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的承诺拒绝', { reason: reason?.message || reason, stack: reason?.stack });
  gracefulShutdown(reason);
});

// 启动应用
startApp().catch((error) => {
  logger.error('应用启动失败', error);
  process.exit(1);
});

module.exports = app;