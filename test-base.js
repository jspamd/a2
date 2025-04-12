const axios = require('axios');

// 添加延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testBase() {
  try {
    console.log('等待服务器启动...');
    await delay(5000); // 等待5秒
    
    console.log('测试服务器基本路由...');
    
    // 测试监控端点
    console.log('\n1. 测试监控端点...');
    const monitorResponse = await axios.get('http://localhost:3002/api/monitor/status');
    console.log('监控端点响应:');
    console.log(JSON.stringify(monitorResponse.data, null, 2));
    
    // 登录获取token
    console.log('\n2. 测试登录接口...');
    const loginResponse = await axios.post('http://localhost:3002/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('登录响应:');
    console.log(JSON.stringify(loginResponse.data, null, 2));
    
    // 使用token测试获取当前用户信息
    console.log('\n3. 测试获取用户信息API（带认证）...');
    const token = loginResponse.data.data.accessToken;
    const userId = loginResponse.data.data.user.id;
    
    console.log(`尝试获取用户ID: ${userId}`);
    console.log(`使用令牌: ${token.substring(0, 20)}...`);
    
    try {
      const usersResponse = await axios.get(`http://localhost:3002/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('用户API响应:');
      console.log(JSON.stringify(usersResponse.data, null, 2));
    } catch (userError) {
      console.error('获取用户详情失败:');
      console.error(`状态码: ${userError.response?.status}`);
      console.error('响应数据:', userError.response?.data);
      console.error('错误堆栈:', userError.stack);
    }
    
  } catch (error) {
    console.error('测试过程中出错:');
    if (error.response) {
      console.error(`状态码: ${error.response.status}`);
      console.error('响应数据:', error.response.data);
      if (error.response.status === 401) {
        console.error('认证头信息:', error.response.config.headers.Authorization);
      }
    } else {
      console.error(error.message);
      console.error(error.stack);
    }
  }
}

testBase(); 