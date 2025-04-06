const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// API基础路径
const API_BASE_URL = 'http://localhost:3002/api';

// 存储认证信息
let token = null;
let userId = null;
let documentId = null;
let folderId = null;
let categoryId = null;

// 获取请求头信息
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// 获取带文件上传的头信息
const getFormHeaders = () => {
  return {
    'Authorization': `Bearer ${token}`
  };
};

// 登录测试
const testLogin = async () => {
  try {
    console.log('测试登录...');
    
    // 可以尝试不同的用户账号
    const credentials = {
      username: 'admin', // 尝试默认管理员账号
      password: 'admin123'
    };
    
    console.log(`尝试使用账号 ${credentials.username} 登录...`);
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
    
    if (response.data.status === 'success') {
      token = response.data.data.accessToken;
      userId = response.data.data.user.id;
      
      console.log('登录成功，获取到token:', token.substring(0, 15) + '...');
      console.log('用户ID:', userId);
      return true;
    } else {
      console.error('登录响应不成功:', response.data);
      return false;
    }
  } catch (error) {
    console.error('登录失败:');
    if (error.response) {
      // 服务器响应了错误状态码
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('未收到响应，请确认服务器是否运行中');
    } else {
      // 请求设置时出现问题
      console.error('请求错误:', error.message);
    }
    return false;
  }
};

// 创建文档分类测试
const testCreateCategory = async () => {
  try {
    console.log('\n测试创建文档分类...');
    
    const categoryData = {
      name: '测试分类',
      code: `TEST_CATEGORY_${Date.now()}`,
      description: '这是一个测试分类'
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/documents/categories`,
      categoryData,
      {
        headers: getHeaders()
      }
    );
    
    categoryId = response.data.data.id;
    console.log('文档分类创建成功，ID:', categoryId);
    console.log('分类名称:', response.data.data.name);
    return true;
  } catch (error) {
    console.error('创建文档分类失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 创建文件夹测试
const testCreateFolder = async () => {
  try {
    console.log('\n测试创建文件夹...');
    
    const folderData = {
      title: '测试文件夹',
      description: '这是一个测试文件夹',
      isPublic: true,
      categoryId: categoryId
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/documents/folders`,
      folderData,
      {
        headers: getHeaders()
      }
    );
    
    folderId = response.data.data.id;
    console.log('文件夹创建成功，ID:', folderId);
    console.log('文件夹标题:', response.data.data.title);
    return true;
  } catch (error) {
    console.error('创建文件夹失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 创建HTML文档测试
const testCreateHtmlDocument = async () => {
  try {
    console.log('\n测试创建HTML文档...');
    
    const documentData = {
      title: 'HTML测试文档',
      content: '<h1>测试标题</h1><p>这是一个<strong>HTML</strong>测试文档</p>',
      description: '这是一个HTML格式的测试文档',
      type: 'html',
      isPublic: true,
      categoryId: categoryId,
      tags: '测试,HTML,文档'
    };
    
    if (folderId) {
      documentData.parentId = folderId;
    }
    
    const response = await axios.post(
      `${API_BASE_URL}/documents`,
      documentData,
      {
        headers: getHeaders()
      }
    );
    
    documentId = response.data.data.id;
    console.log('HTML文档创建成功，ID:', documentId);
    console.log('文档标题:', response.data.data.title);
    return true;
  } catch (error) {
    console.error('创建HTML文档失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 搜索文档测试
const testSearchDocuments = async () => {
  try {
    console.log('\n测试搜索文档...');
    
    // 搜索HTML文档
    const response = await axios.get(
      `${API_BASE_URL}/documents?keyword=HTML`,
      { headers: getHeaders() }
    );
    
    console.log('搜索文档成功，结果数:', response.data.data.length);
    if (response.data.data.length > 0) {
      console.log('第一个结果:', response.data.data[0].title);
    }
    
    // 按分类搜索
    const categoryResponse = await axios.get(
      `${API_BASE_URL}/documents?categoryId=${categoryId}`,
      { headers: getHeaders() }
    );
    
    console.log('按分类搜索成功，结果数:', categoryResponse.data.data.length);
    
    // 按标签搜索
    const tagResponse = await axios.get(
      `${API_BASE_URL}/documents?tag=测试`,
      { headers: getHeaders() }
    );
    
    console.log('按标签搜索成功，结果数:', tagResponse.data.data.length);
    
    return true;
  } catch (error) {
    console.error('搜索文档失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 更新文档标签测试
const testUpdateDocumentTags = async () => {
  try {
    console.log('\n测试更新文档标签...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const updateData = {
      tags: '测试,HTML,文档,已更新'
    };
    
    const response = await axios.put(
      `${API_BASE_URL}/documents/${documentId}`,
      updateData,
      { headers: getHeaders() }
    );
    
    console.log('更新文档标签成功:');
    console.log('新标签:', response.data.data.tags);
    
    return true;
  } catch (error) {
    console.error('更新文档标签失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 测试文档权限
const testDocumentPermissions = async () => {
  try {
    console.log('\n测试文档权限...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    // 设置文档权限
    const permissionData = {
      permissions: [
        {
          targetType: 'user',
          targetId: userId,
          permission: 'edit'
        },
        {
          targetType: 'department',
          targetId: 1, // 假设部门ID为1
          permission: 'read'
        },
        {
          targetType: 'all',
          permission: 'read'
        }
      ]
    };
    
    const response = await axios.put(
      `${API_BASE_URL}/documents/${documentId}/permissions`,
      permissionData,
      { headers: getHeaders() }
    );
    
    console.log('设置文档权限成功');
    
    // 获取文档权限
    const getResponse = await axios.get(
      `${API_BASE_URL}/documents/${documentId}/permissions`,
      { headers: getHeaders() }
    );
    
    console.log('获取文档权限成功，权限数:', getResponse.data.data.length);
    
    return true;
  } catch (error) {
    console.error('测试文档权限失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 测试文档版本比较
const testCompareVersions = async () => {
  try {
    console.log('\n测试文档版本比较...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    // 先创建一个新版本
    const htmlContent = '<h1>更新后的标题</h1><p>这是更新后的<strong>HTML</strong>测试文档</p>';
    const htmlFile = path.join(__dirname, 'test-updated.html');
    fs.writeFileSync(htmlFile, htmlContent);
    
    const form = new FormData();
    form.append('title', '已更新的HTML测试文档');
    form.append('description', '这是更新后的文档描述');
    form.append('changeLog', '更新了文档内容');
    form.append('type', 'html');
    form.append('file', fs.createReadStream(htmlFile), {
      filename: 'test-updated.html',
      contentType: 'text/html'
    });
    
    const uploadResponse = await axios.put(
      `${API_BASE_URL}/documents/${documentId}`,
      form,
      {
        headers: {
          ...getFormHeaders(),
          ...form.getHeaders()
        }
      }
    );
    
    // 清理临时文件
    fs.unlinkSync(htmlFile);
    
    console.log('上传新版本成功，版本ID:', uploadResponse.data.data.id);
    
    // 获取版本列表
    const versionsResponse = await axios.get(
      `${API_BASE_URL}/documents/${documentId}/versions`,
      { headers: getHeaders() }
    );
    
    console.log('获取版本列表成功，版本数:', versionsResponse.data.data.length);
    
    if (versionsResponse.data.data.length >= 2) {
      const version1 = versionsResponse.data.data[0].version;
      const version2 = versionsResponse.data.data[1].version;
      
      // 比较两个版本
      const compareResponse = await axios.get(
        `${API_BASE_URL}/documents/${documentId}/compare?version1=${version1}&version2=${version2}`,
        { headers: getHeaders() }
      );
      
      console.log('版本比较成功:');
      console.log('版本1:', compareResponse.data.data.version1);
      console.log('版本2:', compareResponse.data.data.version2);
      
      return true;
    } else {
      console.log('版本数量不足，无法进行比较');
      return false;
    }
  } catch (error) {
    console.error('测试文档版本比较失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 测试文档预览
const testDocumentPreview = async () => {
  try {
    console.log('\n测试文档预览...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const response = await axios.get(
      `${API_BASE_URL}/documents/${documentId}/preview`,
      { headers: getHeaders() }
    );
    
    console.log('获取文档预览成功');
    console.log('预览内容类型:', response.headers['content-type']);
    
    return true;
  } catch (error) {
    console.error('测试文档预览失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 测试文档统计
const testDocumentStats = async () => {
  try {
    console.log('\n测试文档统计...');
    
    const response = await axios.get(
      `${API_BASE_URL}/documents/stats`,
      { headers: getHeaders() }
    );
    
    console.log('获取文档统计成功:');
    console.log('总文档数:', response.data.data.totalDocuments);
    console.log('分类统计:', response.data.data.categoryStats);
    console.log('每日统计:', response.data.data.dailyStats);
    
    return true;
  } catch (error) {
    console.error('测试文档统计失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 测试文档回收站
const testDocumentRecycleBin = async () => {
  try {
    console.log('\n测试文档回收站...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    // 删除文档（软删除）
    const deleteResponse = await axios.delete(
      `${API_BASE_URL}/documents/${documentId}`,
      { headers: getHeaders() }
    );
    
    console.log('删除文档成功（移至回收站）');
    
    // 获取回收站列表
    const recycleResponse = await axios.get(
      `${API_BASE_URL}/documents/recycle`,
      { headers: getHeaders() }
    );
    
    console.log('获取回收站列表成功，文档数:', recycleResponse.data.data.length);
    
    if (recycleResponse.data.data.length > 0) {
      const deletedDocument = recycleResponse.data.data[0];
      
      // 恢复文档
      const restoreResponse = await axios.post(
        `${API_BASE_URL}/documents/recycle/${deletedDocument.id}/restore`,
        {},
        { headers: getHeaders() }
      );
      
      console.log('恢复文档成功');
    } else {
      console.log('回收站中没有找到被删除的文档');
    }
    
    return true;
  } catch (error) {
    console.error('测试文档回收站失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 运行所有测试
const runAllTests = async () => {
  console.log('======= 开始文档管理高级功能测试 =======');
  console.log('测试时间:', new Date().toLocaleString());
  console.log('API地址:', API_BASE_URL);
  
  // 登录
  if (!await testLogin()) {
    console.log('登录失败，终止测试');
    return;
  }
  
  // 创建文档分类
  await testCreateCategory();
  
  // 创建文件夹
  await testCreateFolder();
  
  // 创建HTML文档
  await testCreateHtmlDocument();
  
  // 搜索文档
  await testSearchDocuments();
  
  // 更新文档标签
  await testUpdateDocumentTags();
  
  // 测试文档权限
  await testDocumentPermissions();
  
  // 测试文档版本比较
  await testCompareVersions();
  
  // 测试文档预览
  await testDocumentPreview();
  
  // 测试文档统计
  await testDocumentStats();
  
  // 测试文档回收站
  await testDocumentRecycleBin();
  
  console.log('\n======= 文档管理高级功能测试完成 =======');
  console.log('测试结束时间:', new Date().toLocaleString());
  console.log('创建的文件夹ID:', folderId);
  console.log('创建的文档ID:', documentId);
  console.log('创建的文档分类ID:', categoryId);
};

// 确保依赖已安装
try {
  require('axios');
  require('form-data');
} catch (error) {
  console.error('缺少必要的依赖项。请运行以下命令安装：');
  console.error('npm install axios form-data');
  process.exit(1);
}

// 执行测试
runAllTests(); 