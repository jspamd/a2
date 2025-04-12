const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { Sequelize } = require('sequelize');
const iconv = require('iconv-lite');
const createAdminUser = require('./seeders/admin-user');

// 设置 Node.js 进程的编码
if (process.platform === 'win32') {
  // 在 Windows 上设置控制台编码
  require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
}

// 环境变量配置
dotenv.config();

// 日志和监控
const { logger, requestLogger } = require('./utils/logger');
const { monitorMiddleware } = require('./utils/monitor');

// 检查依赖
const { checkAndInstallDependencies } = require('./utils/checkDependencies');

// 数据库配置
const dbConfig = require('./config/database');

// 创建 Express 应用
const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3002; // 显式转换 PORT 为数字类型

// 检查并关闭占用端口的进程
async function killProcessOnPort(port) {
  // 输入校验
  if (typeof port !== 'number' || port <= 0 || !Number.isInteger(port)) {
    throw new Error(`Invalid port: ${port}. Port must be a positive integer.`);
  }

  try {
    if (process.platform === 'win32') {
      // Windows系统
      const { stdout } = await execPromise(`netstat -ano | findstr :${escapeShellArg(port.toString())}`);
      if (stdout) {
        const lines = stdout.split('\n');
        const pids = [];
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 4) {
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && pid !== process.pid.toString()) {
              pids.push(pid);
            }
          }
        }
        if (pids.length > 0) {
          // 批量终止进程
          const command = `taskkill /F /PID ${pids.join(' /PID ')}`;
          await execPromise(command);
          logger.info(`已终止占用端口 ${port} 的进程: ${pids.join(', ')}`);
        }
      }
    } else {
      // Unix/Linux/macOS系统
      const { stdout, stderr } = await execPromise(`lsof -i :${escapeShellArg(port.toString())} -t`);
      if (stderr) {
        throw new Error(`lsof 命令执行失败: ${stderr}`);
      }
      if (stdout) {
        const pids = stdout.split('\n').filter(Boolean).filter(pid => pid !== '0' && pid !== process.pid.toString());
        if (pids.length > 0) {
          // 批量终止进程
          const command = `kill -9 ${pids.join(' ')}`;
          await execPromise(command);
          logger.info(`已终止占用端口 ${port} 的进程: ${pids.join(', ')}`);
        }
      }
    }
  } catch (error) {
    // 异常处理
    if (!error.message.includes('没有找到任何任务') &&
        !error.message.includes('No such process')) {
      logger.error(`检查端口占用时发生错误: ${error.message}`);
    }
  }
}

// 辅助函数：转义命令行参数，防止命令注入
function escapeShellArg(arg) {
  return `"${arg.replace(/"/g, '\\"')}"`;
}

// 配置中间件
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// 配置静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 配置API速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: {
    status: 'error',
    message: '请求过于频繁，请稍后再试'
  }
});
app.use('/api', limiter);

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

// 初始化数据库
const initializeDatabase = async () => {
  try {
    logger.info('正在初始化数据库...');
    const models = await require('./models')();

    // 测试数据库连接
    await models.sequelize.authenticate();
    logger.info('数据库连接成功');

    // 同步模型 - 使用更安全的同步方式，避免索引问题
    await models.sequelize.sync({ force: false });
    logger.info('数据库模型同步完成');

    // 创建管理员用户
    await createAdminUser();

    return models;
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    throw error;
  }
};

// API路由
app.get('/api/test', (req, res) => {
  res.json({ message: 'API正常工作' });
});

// 加载路由
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/workflows', require('./routes/workflow.routes'));
app.use('/api/monitor', require('./routes/monitor.routes'));
// app.use('/api/documents', require('./routes/document.routes'));
// app.use('/api/departments', require('./routes/department.routes'));
// app.use('/api/roles', require('./routes/role.routes'));
// app.use('/api/schedules', require('./routes/schedule.routes'));
// app.use('/api/announcements', require('./routes/announcement.routes'));
// app.use('/api/attendance', require('./routes/attendance.routes'));

// 404错误处理
app.use((req, res) => {
  logger.warn('未找到路由:', req.method, req.url);
  res.status(404).json({
    status: 'error',
    message: '未找到请求的资源'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
  });
});

// 启动应用
const startApp = async () => {
  try {
    // 检查依赖
    checkAndInstallDependencies();

    // 创建必要的目录
    await createRequiredDirectories(); // 确保异步操作完成

    // 初始化数据库
    const models = await initializeDatabase();

    // 检查端口占用
    await killProcessOnPort(PORT);
    
    // 等待8秒再启动服务器
    logger.info(`等待8秒后启动服务器...`);
    await new Promise(resolve => setTimeout(resolve, 8000));

    // 启动服务器
    const server = app.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
    });

    // 优雅关闭
    await setupGracefulShutdown(server);
  } catch (error) {
    logger.error('启动应用失败:', error);
    process.exit(1);
  }
};

// 优雅关闭
async function setupGracefulShutdown(server) {
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });
}

// 启动应用
startApp();

module.exports = app;
