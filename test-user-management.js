const axios = require('axios');

// 定义API基础URL
const API_BASE_URL = 'http://localhost:3002/api';

// 测试用户管理功能
async function testUserManagement() {
  try {
    console.log('测试用户管理功能开始...');
    
    // 1. 首先登录获取token
    console.log('1. 登录获取token...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('登录成功！');
    const token = loginResponse.data.data.accessToken;
    
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    
    // 2. 获取所有用户
    console.log('\n2. 获取所有用户...');
    const usersResponse = await axios.get(`${API_BASE_URL}/users`, { headers });
    console.log('获取用户列表成功:');
    console.log(JSON.stringify(usersResponse.data.data, null, 2));
    
    // 3. 获取单个用户
    console.log('\n3. 获取单个用户...');
    const userResponse = await axios.get(`${API_BASE_URL}/users/1`, { headers });
    console.log('获取用户详情成功:');
    console.log(JSON.stringify(userResponse.data.data, null, 2));
    
    // 4. 创建新用户
    console.log('\n4. 创建新用户...');
    const newUser = {
      username: 'testuser',
      password: 'password123',
      name: '测试用户',
      email: 'test@example.com',
      phone: '13812345678',
      position: '测试工程师',
      departmentId: 4
    };
    
    const createResponse = await axios.post(`${API_BASE_URL}/users`, newUser, { headers });
    console.log('创建用户成功:');
    console.log(JSON.stringify(createResponse.data.data, null, 2));
    
    // 5. 获取用户角色
    console.log('\n5. 获取用户角色...');
    const userRolesResponse = await axios.get(`${API_BASE_URL}/users/1/roles`, { headers });
    console.log('获取用户角色成功:');
    console.log(JSON.stringify(userRolesResponse.data.data, null, 2));
    
    // 6. 测试角色管理
    console.log('\n6. 获取所有角色...');
    const rolesResponse = await axios.get(`${API_BASE_URL}/roles`, { headers });
    console.log('获取角色列表成功:');
    console.log(JSON.stringify(rolesResponse.data.data, null, 2));
    
    // 7. 测试部门管理
    console.log('\n7. 获取所有部门...');
    const departmentsResponse = await axios.get(`${API_BASE_URL}/departments`, { headers });
    console.log('获取部门列表成功:');
    console.log(JSON.stringify(departmentsResponse.data.data, null, 2));
    
    console.log('\n测试完成！');
    
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

// 执行测试
testUserManagement(); 