const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');

// 检查依赖
const { checkAndInstallDependencies } = require('./utils/checkDependencies');

// 环境变量配置
dotenv.config();

// 路由导入
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roleRoutes = require('./routes/role.routes');
const departmentRoutes = require('./routes/department.routes');
// 暂时注释掉尚未创建的路由
// const workflowRoutes = require('./routes/workflow.routes');
// const documentRoutes = require('./routes/document.routes');
// const attendanceRoutes = require('./routes/attendance.routes');
// const announcementRoutes = require('./routes/announcement.routes');
// const scheduleRoutes = require('./routes/schedule.routes');

// 数据库连接
const dbConnect = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件配置
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_PATH || 'uploads')));

// 请求限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP在windowMs内最多100个请求
  message: '请求过于频繁，请稍后再试'
});
app.use(limiter);

// 基本路由 - 用于测试
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'OA管理系统API运行正常',
    version: '1.0.0'
  });
});

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/departments', departmentRoutes);
// 暂时注释掉尚未创建的路由
// app.use('/api/workflows', workflowRoutes);
// app.use('/api/documents', documentRoutes);
// app.use('/api/attendance', attendanceRoutes);
// app.use('/api/announcements', announcementRoutes);
// app.use('/api/schedules', scheduleRoutes);

// 404错误处理
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: '未找到请求的资源'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动应用
async function startApp() {
  try {
    // 检查依赖
    const dependenciesReady = await checkAndInstallDependencies();
    if (!dependenciesReady) {
      console.log('请安装缺少的依赖后重新启动应用');
      return;
    }
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      // 连接数据库
      dbConnect();
    });
  } catch (error) {
    console.error('启动应用失败:', error);
    process.exit(1);
  }
}

// 启动应用
startApp();

module.exports = app;