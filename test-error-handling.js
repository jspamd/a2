const axios = require('axios');

// API 基础URL
const API_BASE_URL = 'http://localhost:3002/api';

// 测试错误类型
const testErrors = async () => {
  console.log('===== 开始测试错误处理 =====');
  let token = null;

  // 登录获取token
  try {
    console.log('\n1. 测试登录...');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    token = response.data.data.accessToken;
    console.log('登录成功，获取到token');
  } catch (error) {
    console.error('登录失败:', error.response?.data || error.message);
    return;
  }

  // 测试404错误
  try {
    console.log('\n2. 测试404错误处理...');
    await axios.get(`${API_BASE_URL}/nonexistent-endpoint`);
    console.log('❌ 测试失败：应该返回404错误');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✓ 404错误处理正确');
      console.log('错误消息:', error.response.data.message);
    } else {
      console.error('❌ 错误处理异常:', error.response?.data || error.message);
    }
  }

  // 测试验证错误
  try {
    console.log('\n3. 测试验证错误处理...');
    await axios.post(`${API_BASE_URL}/auth/login`, {
      // 缺少必填字段
    });
    console.log('❌ 测试失败：应该返回验证错误');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✓ 验证错误处理正确');
      console.log('错误消息:', error.response.data.message);
    } else {
      console.error('❌ 错误处理异常:', error.response?.data || error.message);
    }
  }

  // 测试认证错误
  try {
    console.log('\n4. 测试未认证错误处理...');
    await axios.get(`${API_BASE_URL}/users/me`);
    console.log('❌ 测试失败：应该返回未认证错误');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✓ 未认证错误处理正确');
      console.log('错误消息:', error.response.data.message);
    } else {
      console.error('❌ 错误处理异常:', error.response?.data || error.message);
    }
  }

  // 测试无效令牌
  try {
    console.log('\n5. 测试无效令牌错误处理...');
    await axios.get(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': 'Bearer invalid.token.here'
      }
    });
    console.log('❌ 测试失败：应该返回无效令牌错误');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✓ 无效令牌错误处理正确');
      console.log('错误消息:', error.response.data.message);
    } else {
      console.error('❌ 错误处理异常:', error.response?.data || error.message);
    }
  }

  // 测试权限错误
  try {
    console.log('\n6. 测试权限错误处理...');
    // 创建一个普通用户
    const createUserResponse = await axios.post(
      `${API_BASE_URL}/users`,
      {
        username: 'testuser_' + Date.now(),
        password: 'password123',
        name: 'Test User',
        email: `testuser_${Date.now()}@example.com`
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    // 用这个用户登录
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: createUserResponse.data.data.username,
      password: 'password123'
    });
    
    const userToken = loginResponse.data.data.accessToken;
    
    // 尝试访问一个需要管理员权限的API
    await axios.get(`${API_BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    console.log('❌ 测试失败：应该返回权限错误');
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log('✓ 权限错误处理正确');
      console.log('错误消息:', error.response.data.message);
    } else {
      console.error('❌ 错误处理异常:', error.response?.data || error.message);
    }
  }

  console.log('\n===== 错误处理测试完成 =====');
};

// 运行测试
testErrors(); 