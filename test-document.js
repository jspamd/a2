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

// 创建文件夹测试
const testCreateFolder = async () => {
  try {
    console.log('\n测试创建文件夹...');
    
    const folderData = {
      title: '测试文件夹',
      description: '这是一个测试文件夹',
      isPublic: true
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
    
    // 创建HTML文件
    const htmlContent = '<h1>测试标题</h1><p>这是一个<strong>HTML</strong>测试文档</p>';
    const htmlFile = path.join(__dirname, 'test.html');
    fs.writeFileSync(htmlFile, htmlContent);
    
    const form = new FormData();
    form.append('title', 'HTML测试文档');
    form.append('description', '这是一个HTML格式的测试文档');
    form.append('type', 'html');
    form.append('isPublic', 'true');
    if (folderId) {
      form.append('parentId', folderId);
    }
    form.append('file', fs.createReadStream(htmlFile));
    
    const response = await axios.post(
      `${API_BASE_URL}/documents`,
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
    
    // 清理临时文件
    try {
      const htmlFile = path.join(__dirname, 'test.html');
      if (fs.existsSync(htmlFile)) {
        fs.unlinkSync(htmlFile);
      }
    } catch (e) {
      console.error('清理临时文件失败:', e.message);
    }
    
    return false;
  }
};

// 上传文件文档测试
const testUploadFileDocument = async () => {
  try {
    console.log('\n测试上传文件文档...');
    
    // 创建测试文件
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, '这是一个测试上传的文本文件内容');
    
    const form = new FormData();
    form.append('title', '上传的文本文件');
    form.append('description', '这是一个上传的测试文本文件');
    form.append('type', 'file');
    form.append('parentId', folderId);
    form.append('isPublic', 'true');
    form.append('file', fs.createReadStream(testFilePath));
    
    const response = await axios.post(
      `${API_BASE_URL}/documents`,
      form,
      {
        headers: {
          ...getFormHeaders(),
          ...form.getHeaders()
        }
      }
    );
    
    const uploadedDocId = response.data.data.id;
    console.log('文件上传成功，ID:', uploadedDocId);
    console.log('文件标题:', response.data.data.title);
    
    // 清理测试文件
    fs.unlinkSync(testFilePath);
    return true;
  } catch (error) {
    console.error('上传文件失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    
    // 尝试清理测试文件
    try {
      const testFilePath = path.join(__dirname, 'test-upload.txt');
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (e) {
      console.error('清理测试文件失败:', e.message);
    }
    
    return false;
  }
};

// 获取文档列表测试
const testGetDocuments = async () => {
  try {
    console.log('\n测试获取文档列表...');
    
    // 获取所有文档
    const response = await axios.get(
      `${API_BASE_URL}/documents`,
      { headers: getHeaders() }
    );
    
    console.log('获取文档列表成功，总数:', response.data.data.length);
    
    // 如果文件夹ID存在，获取该文件夹内的文档
    if (folderId) {
      try {
        const folderResponse = await axios.get(
          `${API_BASE_URL}/documents?parentId=${folderId}`,
          { headers: getHeaders() }
        );
        
        console.log(`获取文件夹(${folderId})内文档成功，总数:`, folderResponse.data.data.length);
      } catch (folderError) {
        console.error('获取文件夹内文档失败:', folderError.response?.data || folderError.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error('获取文档列表失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 获取文档详情测试
const testGetDocumentDetail = async () => {
  try {
    console.log('\n测试获取文档详情...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const response = await axios.get(
      `${API_BASE_URL}/documents/${documentId}`,
      { headers: getHeaders() }
    );
    
    console.log('获取文档详情成功:');
    console.log('标题:', response.data.data.title);
    console.log('描述:', response.data.data.description);
    console.log('是否公开:', response.data.data.isPublic);
    
    return true;
  } catch (error) {
    console.error('获取文档详情失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 更新文档测试
const testUpdateDocument = async () => {
  try {
    console.log('\n测试更新文档...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const updateData = {
      title: '已更新的HTML测试文档',
      description: '这是更新后的文档描述',
      isPublic: true
    };
    
    const response = await axios.put(
      `${API_BASE_URL}/documents/${documentId}`,
      updateData,
      { headers: getHeaders() }
    );
    
    console.log('更新文档成功:');
    console.log('新标题:', response.data.data.title);
    console.log('新描述:', response.data.data.description);
    
    return true;
  } catch (error) {
    console.error('更新文档失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 添加文档评论测试
const testAddComment = async () => {
  try {
    console.log('\n测试添加文档评论...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const commentData = {
      content: '这是一条测试评论，添加于 ' + new Date().toLocaleString()
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/documents/${documentId}/comments`,
      commentData,
      { headers: getHeaders() }
    );
    
    console.log('添加评论成功:');
    console.log('评论内容:', response.data.data.content);
    console.log('评论时间:', new Date(response.data.data.createdAt).toLocaleString());
    
    return true;
  } catch (error) {
    console.error('添加评论失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 获取文档版本历史测试
const testGetVersions = async () => {
  try {
    console.log('\n测试获取文档版本历史...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const response = await axios.get(
      `${API_BASE_URL}/documents/${documentId}/versions`,
      { headers: getHeaders() }
    );
    
    console.log('获取版本历史成功，版本数:', response.data.data.length);
    response.data.data.forEach((version, index) => {
      console.log(`版本${index + 1}:`, version.changeLog || '无变更日志');
    });
    
    return true;
  } catch (error) {
    console.error('获取版本历史失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 更新文档权限测试
const testUpdatePermissions = async () => {
  try {
    console.log('\n测试更新文档权限...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const permissionData = {
      permissions: [
        {
          targetType: 'all',
          permission: 'read'
        }
      ]
    };
    
    // 如果有用户ID，添加特定用户权限
    if (userId) {
      permissionData.permissions.push({
        targetType: 'user',
        targetId: userId,
        permission: 'edit'
      });
    }
    
    const response = await axios.put(
      `${API_BASE_URL}/documents/${documentId}/permissions`,
      permissionData,
      { headers: getHeaders() }
    );
    
    console.log('更新文档权限成功');
    console.log('权限设置:', JSON.stringify(response.data.data, null, 2));
    return true;
  } catch (error) {
    console.error('更新文档权限失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 删除文档测试
const testDeleteDocument = async () => {
  try {
    console.log('\n测试删除文档和文件夹...');
    console.log('注意: 为了保留测试数据以便查看，默认不执行删除操作');
    console.log('如需测试删除功能，请取消下方代码的注释');
    
    /*
    // 删除文档
    if (documentId) {
      await axios.delete(
        `${API_BASE_URL}/documents/${documentId}`,
        { headers: getHeaders() }
      );
      
      console.log('删除文档成功');
    }
    
    // 删除文件夹
    if (folderId) {
      await axios.delete(
        `${API_BASE_URL}/documents/${folderId}`,
        { headers: getHeaders() }
      );
      
      console.log('删除文件夹成功');
    }
    */
    
    return true;
  } catch (error) {
    console.error('删除操作失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 下载文档测试
const testDownloadDocument = async () => {
  try {
    console.log('\n测试下载文档...');
    
    if (!documentId) {
      console.log('没有可用的文档ID，跳过此测试');
      return false;
    }
    
    const response = await axios.get(
      `${API_BASE_URL}/documents/${documentId}/download`,
      { 
        headers: getHeaders(),
        responseType: 'stream'
      }
    );
    
    const downloadPath = path.join(__dirname, 'downloaded-document.txt');
    const writer = fs.createWriteStream(downloadPath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('文档下载成功，保存至:', downloadPath);
        console.log('文件大小:', fs.statSync(downloadPath).size, '字节');
        resolve(true);
      });
      
      writer.on('error', (err) => {
        console.error('保存下载文件失败:', err.message);
        reject(err);
      });
    });
  } catch (error) {
    console.error('下载文档失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data || '(二进制数据)');
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
};

// 运行所有测试
const runAllTests = async () => {
  console.log('======= 开始文档管理功能测试 =======');
  console.log('测试时间:', new Date().toLocaleString());
  console.log('API地址:', API_BASE_URL);
  
  // 检查服务器可用性
  // try {
  //   await axios.get(API_BASE_URL);
  //   console.log('API服务器可用\n');
  // } catch (error) {
  //   console.error('API服务器不可用，请确认服务器是否运行');
  //   console.error('错误详情:', error.message);
  //   return;
  // }
  
  // 登录
  if (!await testLogin()) {
    console.log('登录失败，终止测试');
    return;
  }
  
  // 基础文档操作测试
  await testCreateFolder();
  await testCreateHtmlDocument();
  await testUploadFileDocument();
  await testGetDocuments();
  await testGetDocumentDetail();
  
  // 文档编辑和权限测试
  await testUpdateDocument();
  await testAddComment();
  await testGetVersions();
  await testUpdatePermissions();
  await testDownloadDocument();
  
  // 删除测试（默认注释掉，避免删除刚创建的测试数据）
  await testDeleteDocument();
  
  console.log('\n======= 文档管理功能测试完成 =======');
  console.log('测试结束时间:', new Date().toLocaleString());
  console.log('创建的文件夹ID:', folderId);
  console.log('创建的文档ID:', documentId);
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