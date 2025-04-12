const axios = require('axios');

// 定义API基础URL
const API_BASE_URL = 'http://localhost:3002/api';

// 测试用户管理功能
async function testUserManagement() {
  console.log('测试用户管理功能开始...');
  let token = null;
  
  try {
    // 1. 首先登录获取token
    console.log('1. 登录获取token...');
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      
      console.log('登录成功！');
      token = loginResponse.data.data.accessToken;
      console.log('用户角色:', loginResponse.data.data.user.role); // 输出用户角色信息
      
      const headers = {
        'Authorization': `Bearer ${token}`
      };
      
      // 2. 获取所有用户
      console.log('\n2. 获取所有用户...');
      try {
        const usersResponse = await axios.get(`${API_BASE_URL}/users`, { headers });
        console.log('获取用户列表成功:');
        console.log(`总用户数: ${usersResponse.data.data.length}`);
        console.log(`第一个用户: ${usersResponse.data.data[0].username}`);
      } catch (error) {
        console.error('获取用户列表失败:', error.response ? error.response.data : error.message);
      }
      
      // 3. 获取单个用户
      console.log('\n3. 获取单个用户...');
      try {
        const userResponse = await axios.get(`${API_BASE_URL}/users/1`, { headers });
        console.log('获取用户详情成功:');
        console.log(`用户名: ${userResponse.data.data.username}`);
        console.log(`邮箱: ${userResponse.data.data.email}`);
      } catch (error) {
        console.error('获取用户详情失败:', error.response ? error.response.data : error.message);
      }
      
      // 4. 创建新用户
      console.log('\n4. 创建新用户...');
      const timestamp = Date.now();
      const newUser = {
        username: `testuser_${timestamp}`,
        password: 'password123',
        name: '测试用户',
        email: `test_${timestamp}@example.com`,
        phone: '13812345678',
        position: '测试工程师',
        departmentId: 1
      };
      
      try {
        const createResponse = await axios.post(`${API_BASE_URL}/users`, newUser, { headers });
        console.log('创建用户成功:');
        console.log(`用户ID: ${createResponse.data.data.id}`);
        console.log(`用户名: ${createResponse.data.data.username}`);
        
        // 保存新创建的用户ID以便后续测试
        const newUserId = createResponse.data.data.id;
        
        // 5. 获取用户角色
        console.log('\n5. 获取用户角色...');
        try {
          const userRolesResponse = await axios.get(`${API_BASE_URL}/users/${newUserId}/roles`, { headers });
          console.log('获取用户角色成功:');
          console.log(`角色数量: ${userRolesResponse.data.data.length}`);
        } catch (error) {
          console.error('获取用户角色失败:', error.response ? error.response.data : error.message);
        }
      } catch (error) {
        console.error('创建用户失败:', error.response ? error.response.data : error.message);
      }
      
      // 6. 测试角色管理
      console.log('\n6. 获取所有角色...');
      try {
        const rolesResponse = await axios.get(`${API_BASE_URL}/roles`, { headers });
        console.log('获取角色列表成功:');
        console.log(`角色数量: ${rolesResponse.data.data.length}`);
      } catch (error) {
        console.error('获取角色列表失败:', error.response ? error.response.data : error.message);
      }
      
      // 7. 测试部门管理
      console.log('\n7. 获取所有部门...');
      try {
        const departmentsResponse = await axios.get(`${API_BASE_URL}/departments`, { headers });
        console.log('获取部门列表成功:');
        console.log(`部门数量: ${departmentsResponse.data.data.length}`);
      } catch (error) {
        console.error('获取部门列表失败:', error.response ? error.response.data : error.message);
      }
      
      console.log('\n测试完成！');
      
    } catch (error) {
      console.error('登录失败:');
      if (error.response) {
        console.error('状态码:', error.response.status);
        console.error('错误数据:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('未收到响应，请确认服务器是否运行');
      } else {
        console.error('请求出错:', error.message);
      }
      console.error('完整错误:', error);
    }
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