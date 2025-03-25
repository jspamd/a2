const axios = require('axios');

// 测试登录功能
async function testLogin() {
  try {
    console.log('正在测试登录功能...');
    
    // 1. 测试正确的用户名和密码
    const loginResponse = await axios.post('http://localhost:3002/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('登录成功！获取到的token和用户信息：');
    console.log(JSON.stringify(loginResponse.data, null, 2));
    
    // 保存token供后续请求使用
    const token = loginResponse.data.data.accessToken;
    
    // 2. 利用token获取当前用户信息
    console.log('\n正在获取当前用户信息...');
    const userInfoResponse = await axios.get('http://localhost:3002/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('获取用户信息成功：');
    console.log(JSON.stringify(userInfoResponse.data, null, 2));
    
    // 3. 测试错误的凭据
    console.log('\n测试错误的用户名和密码...');
    try {
      await axios.post('http://localhost:3002/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
    } catch (error) {
      console.log('登录失败（符合预期）：');
      console.log(error.response.data);
    }
    
    console.log('\n测试完成！');
    
  } catch (error) {
    console.error('测试过程中出错：');
    console.error(error.response ? error.response.data : error.message);
  }
}

// 执行测试
testLogin(); 