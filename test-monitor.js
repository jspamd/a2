const axios = require('axios');

// API基础路径
const API_BASE_URL = 'http://localhost:3002/api';

// 存储认证信息
let token = null;
let userId = null;

// 获取请求头信息
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// 登录测试
const testLogin = async () => {
  try {
    console.log('测试登录...');
    
    // 明确使用管理员账号
    const credentials = {
      username: 'admin',
      password: 'admin123'
    };
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
    
    // 修改token获取逻辑，根据实际API响应结构
    token = response.data.data.accessToken;
    userId = response.data.data.user.id;
    
    // 验证是否有管理员角色
    const userResponse = await axios.get(
      `${API_BASE_URL}/auth/me`, 
      { headers: getHeaders() }
    );
    
    const userRoles = userResponse.data.data.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin) {
      console.warn('警告: 当前用户不是管理员，某些监控API可能无法访问');
    }
    
    console.log('登录成功，获取到token:', token.substring(0, 15) + '...');
    console.log('用户ID:', userId);
    console.log('用户角色:', userRoles.length ? userRoles.join(', ') : '无角色');
    return true;
  } catch (error) {
    console.error('登录失败:', error.response?.data || error.message);
    return false;
  }
};

// 测试健康检查
const testHealthCheck = async () => {
  try {
    console.log('\n测试健康检查...');
    const response = await axios.get(`${API_BASE_URL}/monitor/health`);
    
    console.log('健康检查结果:');
    console.log('状态:', response.data.status);
    console.log('问题:', response.data.issues);
    console.log('时间戳:', response.data.timestamp);
    return true;
  } catch (error) {
    console.error('健康检查失败:', error.response?.data || error.message);
    return false;
  }
};

// 测试系统状态
const testSystemStatus = async () => {
  try {
    console.log('\n测试系统状态...');
    const response = await axios.get(`${API_BASE_URL}/monitor/status`);
    
    console.log('系统状态结果:');
    console.log('消息:', response.data.message);
    console.log('运行时间:', response.data.uptime);
    console.log('时间戳:', response.data.timestamp);
    return true;
  } catch (error) {
    console.error('系统状态检查失败:', error.response?.data || error.message);
    return false;
  }
};

// 测试系统指标
const testSystemMetrics = async () => {
  try {
    console.log('\n测试系统指标...');
    const response = await axios.get(
      `${API_BASE_URL}/monitor/metrics`,
      { headers: getHeaders() }
    );
    
    console.log('系统指标结果:');
    console.log('主机名:', response.data.data.hostname);
    console.log('平台:', response.data.data.platform);
    console.log('Node版本:', response.data.data.nodeVersion);
    console.log('运行时间:', response.data.data.uptimeHuman);
    console.log('CPU数量:', response.data.data.cpuCount);
    console.log('CPU负载:', response.data.data.cpuLoad);
    console.log('内存使用率:', response.data.data.memoryUsagePercent);
    console.log('请求数:', response.data.data.requestCount);
    console.log('错误数:', response.data.data.errorCount);
    console.log('慢请求数:', response.data.data.slowRequestCount);
    return true;
  } catch (error) {
    console.error('系统指标检查失败:', error.response?.data || error.message);
    return false;
  }
};

// 测试详细健康状态
const testDetailedHealth = async () => {
  try {
    console.log('\n测试详细健康状态...');
    const response = await axios.get(
      `${API_BASE_URL}/monitor/health/details`,
      { headers: getHeaders() }
    );
    
    console.log('详细健康状态结果:');
    console.log('状态:', response.data.data.status);
    console.log('问题:', response.data.data.issues);
    console.log('指标:', response.data.data.metrics ? '获取成功' : '获取失败');
    return true;
  } catch (error) {
    console.error('详细健康状态检查失败:', error.response?.data || error.message);
    return false;
  }
};

// 测试重置统计信息
const testResetStats = async () => {
  try {
    console.log('\n测试重置统计信息...');
    const response = await axios.post(
      `${API_BASE_URL}/monitor/reset-stats`,
      {},
      { headers: getHeaders() }
    );
    
    console.log('重置统计信息结果:');
    console.log('消息:', response.data.message);
    return true;
  } catch (error) {
    console.error('重置统计信息失败:', error.response?.data || error.message);
    return false;
  }
};

// 测试生成错误
const testGenerateError = async () => {
  try {
    console.log('\n测试生成错误...');
    await axios.get(`${API_BASE_URL}/non-existent-route`);
    return false; // 这应该不会执行，因为上面的请求应该会失败
  } catch (error) {
    console.log('已触发404错误，检查日志文件查看是否记录');
    return true;
  }
};

// 创建一些负载，用于测试监控
const generateLoad = async () => {
  console.log('\n生成一些负载来测试监控...');
  
  const requests = [];
  const requestCount = 20;
  
  for (let i = 0; i < requestCount; i++) {
    requests.push(axios.get(`${API_BASE_URL}/monitor/status`).catch(() => {}));
  }
  
  await Promise.all(requests);
  console.log(`已发送 ${requestCount} 个请求，等待几秒钟再检查系统指标`);
  
  return new Promise(resolve => setTimeout(() => resolve(true), 3000));
};

// 运行所有测试
const runAllTests = async () => {
  console.log('======= 开始监控和日志系统测试 =======');
  
  // 测试不需要认证的路由
  await testHealthCheck();
  await testSystemStatus();
  
  // 登录
  if (!await testLogin()) {
    console.log('登录失败，无法继续需要认证的测试');
    return;
  }
  
  // 测试需要认证的路由
  await testSystemMetrics();
  await testDetailedHealth();
  
  // 生成一些负载
  await generateLoad();
  
  // 再次检查系统指标
  await testSystemMetrics();
  
  // 测试生成错误
  await testGenerateError();
  
  // 重置统计
  await testResetStats();
  
  // 最后再次检查系统指标
  await testSystemMetrics();
  
  console.log('\n======= 监控和日志系统测试完成 =======');
  console.log('请检查logs目录中的日志文件，确认日志是否正确记录');
};

// 执行测试
runAllTests();