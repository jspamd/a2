const axios = require('axios');
const moment = require('moment');

// API基础路径
const API_BASE_URL = 'http://localhost:3002/api';

// 存储认证信息
let token = null;
let userId = null;
let workflowId = null;
let instanceId = null;
let taskId = null;

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
    console.log('发送登录请求到:', `${API_BASE_URL}/auth/login`);
    console.log('请求数据:', { username: 'admin', password: 'admin123' });
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('收到响应:', response.data);
    
    if (response.data.status === 'success') {
      token = response.data.data.accessToken;
      userId = response.data.data.user.id;
      
      console.log('登录成功，获取到token:', token.substring(0, 15) + '...');
      console.log('用户ID:', userId);
      return true;
    } else {
      console.error('登录失败:', response.data.message);
      return false;
    }
  } catch (error) {
    if (error.response) {
      console.error('登录失败 - 服务器响应:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      console.error('登录请求失败 - 无响应:', {
        message: error.message,
        code: error.code,
        request: {
          method: error.request.method,
          path: error.request.path,
          headers: error.request.headers
        }
      });
      console.error('请确保服务器已启动并在端口3002上运行');
    } else {
      console.error('登录错误:', {
        message: error.message,
        stack: error.stack,
        config: error.config
      });
    }
    return false;
  }
};

// 创建工作流定义测试
const testCreateWorkflow = async () => {
  try {
    console.log('\n测试创建工作流定义...');
    const workflowData = {
      name: '请假审批流程',
      code: 'LEAVE_APPROVAL',
      category: 'leave',
      description: '员工请假审批流程',
      nodeConfig: {
        nodes: [
          {
            id: 'start',
            type: 'start',
            name: '开始'
          },
          {
            id: 'fill_form',
            type: 'approval',
            name: '填写请假单',
            assigneeType: 'initiator'
          },
          {
            id: 'manager_approval',
            type: 'approval',
            name: '经理审批',
            assigneeType: 'role',
            assigneeId: 'manager'
          },
          {
            id: 'hr_approval',
            type: 'approval',
            name: 'HR审批',
            assigneeType: 'role',
            assigneeId: 'hr'
          },
          {
            id: 'end',
            type: 'end',
            name: '结束'
          }
        ],
        edges: [
          {
            source: 'start',
            target: 'fill_form'
          },
          {
            source: 'fill_form',
            target: 'manager_approval'
          },
          {
            source: 'manager_approval',
            target: 'hr_approval'
          },
          {
            source: 'hr_approval',
            target: 'end'
          }
        ]
      },
      formConfig: {
        type: 'object',
        properties: {
          leaveType: {
            type: 'string',
            title: '请假类型',
            enum: ['年假', '事假', '病假', '调休'],
            required: true
          },
          startDate: {
            type: 'string',
            title: '开始日期',
            format: 'date',
            required: true
          },
          endDate: {
            type: 'string',
            title: '结束日期',
            format: 'date',
            required: true
          },
          reason: {
            type: 'string',
            title: '请假原因',
            required: true
          }
        }
      },
      status: 'active'
    };

    const response = await axios.post(
      `${API_BASE_URL}/workflows`,
      workflowData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('创建工作流定义成功:', response.data);
    workflowId = response.data.data.id;
  } catch (error) {
    console.log('创建工作流失败:', error.response?.data || error.message);
  }
};

// 获取工作流定义列表测试
const testGetWorkflows = async () => {
  try {
    console.log('\n测试获取工作流定义列表...');
    
    const response = await axios.get(
      `${API_BASE_URL}/workflows`,
      { headers: getHeaders() }
    );
    
    console.log('获取工作流定义列表成功，总数:', response.data.data.length);
    
    // 如果之前没有创建工作流，使用第一个工作流的ID
    if (!workflowId && response.data.data.length > 0) {
      workflowId = response.data.data[0].id;
      console.log('使用已有工作流，ID:', workflowId);
    }
    
    return true;
  } catch (error) {
    console.error('获取工作流定义列表失败:', error.response?.data || error.message);
    return false;
  }
};

// 获取工作流定义详情测试
const testGetWorkflowDetail = async () => {
  try {
    console.log('\n测试获取工作流定义详情...');
    
    const response = await axios.get(
      `${API_BASE_URL}/workflows/${workflowId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('获取工作流定义详情成功:');
    console.log('工作流名称:', response.data.data.name);
    console.log('工作流编码:', response.data.data.code);
    console.log('工作流类别:', response.data.data.category);
    console.log('工作流状态:', response.data.data.status);
    
    return true;
  } catch (error) {
    console.error('获取工作流定义详情失败:', error.response?.data || error.message);
    return false;
  }
};

// 启动工作流实例测试
const testStartWorkflowInstance = async () => {
  try {
    console.log('\n测试启动工作流实例...');
    if (!workflowId) {
      console.log('没有可用的工作流定义ID，跳过测试');
      return;
    }

    const instanceData = {
      workflowDefinitionId: workflowId,
      title: '张三的年假申请',
      formData: {
        leaveType: '年假',
        startDate: '2024-04-10',
        endDate: '2024-04-12',
        reason: '计划休年假3天'
      }
    };

    const response = await axios.post(
      `${API_BASE_URL}/workflows/instances`,
      instanceData,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('启动工作流实例成功:', response.data);
    instanceId = response.data.data.id;
    return true;
  } catch (error) {
    console.log('启动工作流实例失败:', error.response?.data || error.message);
    return false;
  }
};

// 获取工作流实例列表测试
const testGetWorkflowInstances = async () => {
  try {
    console.log('\n测试获取工作流实例列表...');
    
    const response = await axios.get(
      `${API_BASE_URL}/workflows/instances`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('获取工作流实例列表成功，总数:', response.data.data.total);
    console.log('当前页实例数:', response.data.data.rows.length);
    
    // 如果之前没有创建实例，使用第一个实例的ID
    if (!instanceId && response.data.data.rows.length > 0) {
      instanceId = response.data.data.rows[0].id;
      console.log('使用已有实例，ID:', instanceId);
    }
    
    return true;
  } catch (error) {
    console.error('获取工作流实例列表失败:', error.response?.data || error.message);
    return false;
  }
};

// 获取工作流实例详情测试
const testGetWorkflowInstanceDetail = async () => {
  try {
    console.log('\n测试获取工作流实例详情...');
    if (!instanceId) {
      console.log('没有可用的工作流实例ID，跳过测试');
      return;
    }
    
    const response = await axios.get(
      `${API_BASE_URL}/workflows/instances/${instanceId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('获取工作流实例详情成功:');
    console.log('实例标题:', response.data.data.title);
    console.log('实例状态:', response.data.data.status);
    console.log('当前节点:', response.data.data.currentNode);
    console.log('表单数据:', JSON.stringify(response.data.data.formData, null, 2));
    
    return true;
  } catch (error) {
    console.error('获取工作流实例详情失败:', error.response?.data || error.message);
    return false;
  }
};

// 获取待办任务列表测试
const testGetMyTasks = async () => {
  try {
    console.log('\n测试获取待办任务列表...');
    
    const response = await axios.get(
      `${API_BASE_URL}/workflows/tasks/my`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('获取待办任务列表成功:');
    console.log('总任务数:', response.data.data.total);
    console.log('当前页任务数:', response.data.data.rows.length);
    
    // 如果之前没有获取任务，使用第一个任务的ID
    if (!taskId && response.data.data.rows.length > 0) {
      taskId = response.data.data.rows[0].id;
      console.log('使用已有任务，ID:', taskId);
    }
    
    return true;
  } catch (error) {
    console.error('获取待办任务列表失败:', error.response?.data || error.message);
    return false;
  }
};

// 处理任务测试
const testProcessTask = async () => {
  try {
    console.log('\n测试处理任务...');
    if (!taskId) {
      console.log('没有可处理的任务，跳过测试');
      return;
    }
    
    const taskProcess = {
      action: 'approve',
      comment: '同意请假申请',
      data: {
        approverComment: '批准，注意按时销假'
      }
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/workflows/tasks/${taskId}/process`,
      taskProcess,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('任务处理成功:');
    console.log('处理结果:', response.data.data.action);
    console.log('处理意见:', response.data.data.comment);
    console.log('处理时间:', response.data.data.processTime);
    
    return true;
  } catch (error) {
    console.error('处理任务失败:', error.response?.data || error.message);
    return false;
  }
};

// 取消工作流实例测试
const testCancelWorkflowInstance = async () => {
  try {
    console.log('\n测试取消工作流实例...');
    if (!instanceId) {
      console.log('没有可取消的工作流实例，跳过测试');
      return;
    }
    
    const response = await axios.post(
      `${API_BASE_URL}/workflows/instances/${instanceId}/cancel`,
      { reason: '测试取消功能' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('工作流实例取消成功:', response.data);
    return true;
  } catch (error) {
    console.error('取消工作流实例失败:', error.response?.data || error.message);
    return false;
  }
};

// 更新工作流定义测试
const testUpdateWorkflow = async () => {
  try {
    console.log('\n测试更新工作流定义...');
    if (!workflowId) {
      console.log('没有可更新的工作流定义，跳过测试');
      return;
    }
    
    // 更新工作流
    const updatedWorkflow = {
      name: '请假审批流程（已更新）',
      description: '员工请假需要经过部门主管和HR审批 - 更新版本',
      status: 'active'
    };
    
    const response = await axios.put(
      `${API_BASE_URL}/workflows/${workflowId}`,
      updatedWorkflow,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('工作流更新成功:');
    console.log('新名称:', response.data.data.name);
    console.log('新描述:', response.data.data.description);
    console.log('状态:', response.data.data.status);
    
    return true;
  } catch (error) {
    console.error('更新工作流定义失败:', error.response?.data || error.message);
    return false;
  }
};

// 运行所有测试
const runAllTests = async () => {
  console.log('======= 开始工作流管理功能测试 =======');
  
  // 登录
  if (!await testLogin()) {
    console.log('登录失败，终止测试');
    return;
  }
  
  // 工作流定义测试
  await testCreateWorkflow();
  await testGetWorkflows();
  await testGetWorkflowDetail();
  
  // 工作流实例测试
  await testStartWorkflowInstance();
  await testGetWorkflowInstances();
  await testGetWorkflowInstanceDetail();
  
  // 任务测试
  await testGetMyTasks();
  await testProcessTask();
  
  // 其他操作测试
  await testCancelWorkflowInstance();
  await testUpdateWorkflow();
  
  console.log('\n======= 工作流管理功能测试完成 =======');
};

// 执行测试
runAllTests(); 