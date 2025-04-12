const express = require('express');
const router = express.Router();
const { getSystemMetrics, getHealthStatus, resetStats } = require('../utils/monitor');
const { verifyToken, checkRole } = require('../middleware/auth');

// 健康检查 - 无需认证，供负载均衡和监控系统使用
router.get('/health', (req, res) => {
  const healthStatus = getHealthStatus();
  
  // 根据健康状态设置状态码
  let statusCode = 200;
  if (healthStatus.status === 'warning') {
    statusCode = 200; // 仍返回200，但带有警告信息
  } else if (healthStatus.status === 'critical') {
    statusCode = 503; // 服务不可用
  }
  
  res.status(statusCode).json({
    status: healthStatus.status,
    issues: healthStatus.issues,
    timestamp: new Date().toISOString()
  });
});

// 简单的系统状态 - 无需认证，用于基本检查
router.get('/status', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'System is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 以下路由需要认证
router.use(verifyToken);

// 获取系统指标 - 改为所有认证用户可访问
router.get('/metrics', (req, res) => {
  const metrics = getSystemMetrics();
  
  res.status(200).json({
    status: 'success',
    data: metrics
  });
});

// 获取详细健康状态 - 改为所有认证用户可访问
router.get('/health/details', (req, res) => {
  const healthStatus = getHealthStatus();
  
  res.status(200).json({
    status: 'success',
    data: healthStatus
  });
});

// 重置监控统计信息 - 改为所有认证用户可访问
router.post('/reset-stats', (req, res) => {
  resetStats();
  
  res.status(200).json({
    status: 'success',
    message: '监控统计信息已重置'
  });
});

module.exports = router; 