const axios = require('axios');

async function testSimple() {
  try {
    console.log('测试服务器状态...');
    
    const response = await axios.get('http://localhost:3002/api/monitor/status');
    console.log('服务器状态响应:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n测试登录...');
    const loginResponse = await axios.post('http://localhost:3002/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('登录响应:');
    console.log(JSON.stringify(loginResponse.data, null, 2));
    
    const token = loginResponse.data.data.accessToken;
    
    console.log('\n测试文档分类API...');
    try {
      const categoriesResponse = await axios.get(
        'http://localhost:3002/api/documents/categories',
        { 
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('文档分类响应:');
      console.log(JSON.stringify(categoriesResponse.data, null, 2));
    } catch (error) {
      console.error('获取文档分类失败:');
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error('响应数据:', error.response.data);
      } else {
        console.error('错误:', error.message);
      }
    }
    
  } catch (error) {
    console.error('测试失败:');
    if (error.response) {
      console.error(`状态码: ${error.response.status}`);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
  }
}

testSimple(); 