const os = require('os');
const { logger } = require('./logger');
const process = require('process');

// 系统监控相关的变量
let startTime = Date.now();
let requestCount = 0;
let errorCount = 0;
let slowRequestCount = 0;
let lastMetricsLog = Date.now();
const METRICS_LOG_INTERVAL = 60 * 1000; // 每分钟记录一次指标
const SLOW_REQUEST_THRESHOLD = 1000; // 慢请求阈值，1秒

// 获取系统指标
const getSystemMetrics = () => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  return {
    // 系统信息
    hostname: os.hostname(),
    platform: process.platform,
    arch: os.arch(),
    nodeVersion: process.version,
    
    // 运行时间
    uptime: uptime,
    uptimeHuman: formatUptime(uptime),
    
    // CPU 使用情况
    cpuCount: os.cpus().length,
    cpuLoad: os.loadavg(),
    cpuUsage: process.cpuUsage(),
    
    // 内存使用情况
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    usedMemory: os.totalmem() - os.freemem(),
    memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%',
    processMemory: process.memoryUsage(),
    
    // 请求统计
    requestCount,
    errorCount,
    slowRequestCount,
    
    // 时间
    timestamp: new Date().toISOString()
  };
};

// 格式化运行时间
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

// 定期记录系统指标到日志
const logSystemMetrics = () => {
  const now = Date.now();
  if (now - lastMetricsLog >= METRICS_LOG_INTERVAL) {
    const metrics = getSystemMetrics();
    logger.info('System metrics', { metrics });
    lastMetricsLog = now;
  }
};

// 系统监控中间件
const monitorMiddleware = (req, res, next) => {
  // 增加请求计数
  requestCount++;
  
  // 记录请求开始时间
  const start = Date.now();
  
  // 重写 end 方法以捕获响应完成时间
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // 如果是错误响应，增加错误计数
    if (res.statusCode >= 400) {
      errorCount++;
    }
    
    // 如果是慢请求，增加慢请求计数
    if (duration > SLOW_REQUEST_THRESHOLD) {
      slowRequestCount++;
      logger.warn('Slow request detected', {
        url: req.originalUrl || req.url,
        method: req.method,
        duration: duration + 'ms',
        threshold: SLOW_REQUEST_THRESHOLD + 'ms'
      });
    }
    
    // 定期记录系统指标
    logSystemMetrics();
    
    // 调用原始的 end 方法
    return originalEnd.apply(this, args);
  };
  
  next();
};

// 获取系统健康状态
const getHealthStatus = () => {
  const metrics = getSystemMetrics();
  
  // 计算健康状态
  const memoryUsagePercent = parseFloat(metrics.memoryUsagePercent);
  const cpuLoad = metrics.cpuLoad[0]; // 1分钟平均负载
  
  let status = 'healthy';
  const issues = [];
  
  // 检查内存使用情况
  if (memoryUsagePercent > 90) {
    status = 'critical';
    issues.push('内存使用率超过90%');
  } else if (memoryUsagePercent > 80) {
    status = status === 'critical' ? 'critical' : 'warning';
    issues.push('内存使用率超过80%');
  }
  
  // 检查CPU负载
  const cpuCount = metrics.cpuCount;
  if (cpuLoad > cpuCount * 0.9) {
    status = 'critical';
    issues.push('CPU负载过高');
  } else if (cpuLoad > cpuCount * 0.7) {
    status = status === 'critical' ? 'critical' : 'warning';
    issues.push('CPU负载较高');
  }
  
  // 检查慢请求比例
  if (metrics.requestCount > 0) {
    const slowRequestPercent = (metrics.slowRequestCount / metrics.requestCount * 100).toFixed(2);
    if (slowRequestPercent > 5) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`慢请求比例过高: ${slowRequestPercent}%`);
    }
  }
  
  return {
    status,
    issues,
    metrics
  };
};

// 重置统计信息
const resetStats = () => {
  requestCount = 0;
  errorCount = 0;
  slowRequestCount = 0;
  startTime = Date.now();
  logger.info('Monitor stats have been reset');
};

module.exports = {
  getSystemMetrics,
  monitorMiddleware,
  getHealthStatus,
  resetStats,
  SLOW_REQUEST_THRESHOLD
}; 