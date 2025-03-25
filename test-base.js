const axios = require('axios');

async function testBase() {
  try {
    console.log('测试服务器基本路由...');
    
    const response = await axios.get('http://localhost:3002/');
    console.log('服务器响应:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('测试过程中出错:');
    if (error.response) {
      console.error(`状态码: ${error.response.status}`);
      console.error('响应数据:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testBase(); 