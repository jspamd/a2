// 设置 Node.js 进程的编码
if (process.platform === 'win32') {
  // 在 Windows 上设置控制台编码
  require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
}

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// 启动应用
try {
  require('./src/app.js');
} catch (error) {
  console.error('启动应用时发生错误:', error);
  process.exit(1);
} 