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
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    token = response.data.data.token;
    userId = response.data.data.user.id;
    
    console.log('登录成功，获取到token:', token.substring(0, 15) + '...');
    console.log('用户ID:', userId);
    return true;
  } catch (error) {
    console.error('登录失败:', error.response?.data || error.message);
    return false;
  }
};

// 创建工作流定义测试
const testCreateWorkflow = async () => {
  try {
    console.log('\n测试创建工作流定义...');
    
    // 创建一个请假审批工作流
    const workflow = {
      name: '请假审批流程',
      description: '员工请假需要经过部门主管和HR审批',
      type: 'approval',
      nodes: [
        {
          id: 'start',
          type: 'start',
          label: '开始',
          position: { x: 100, y: 100 }
        },
        {
          id: 'form',
          type: 'task',
          label: '填写请假单',
          position: { x: 100, y: 200 },
          properties: {
            description: '请填写请假信息',
            assigneeType: 'initiator'
          }
        },
        {
          id: 'manager_approval',
          type: 'approval',
          label: '部门主管审批',
          position: { x: 100, y: 300 },
          approvers: [
            { type: 'initiator_supervisor', id: null }
          ],
          properties: {
            description: '请审批下属的请假申请',
            deadline: 24 // 24小时内完成
          }
        },
        {
          id: 'hr_approval',
          type: 'approval',
          label: 'HR审批',
          position: { x: 100, y: 400 },
          approvers: [
            { type: 'role', id: 3 } // 假设HR角色ID为3
          ],
          properties: {
            description: '请进行最终审批',
            deadline: 48 // 48小时内完成
          }
        },
        {
          id: 'end',
          type: 'end',
          label: '结束',
          position: { x: 100, y: 500 }
        }
      ],
      edges: [
        {
          id: 'edge1',
          source: 'start',
          target: 'form'
        },
        {
          id: 'edge2',
          source: 'form',
          target: 'manager_approval'
        },
        {
          id: 'edge3',
          source: 'manager_approval',
          target: 'hr_approval'
        },
        {
          id: 'edge4',
          source: 'hr_approval',
          target: 'end'
        }
      ],
      formFields: [
        {
          key: 'leaveType',
          label: '请假类型',
          type: 'select',
          options: ['年假', '病假', '事假', '婚假', '丧假', '产假', '其他'],
          required: true
        },
        {
          key: 'startDate',
          label: '开始日期',
          type: 'date',
          required: true
        },
        {
          key: 'endDate',
          label: '结束日期',
          type: 'date',
          required: true
        },
        {
          key: 'reason',
          label: '请假原因',
          type: 'textarea',
          required: true
        },
        {
          key: 'contactInfo',
          label: '请假期间联系方式',
          type: 'text',
          required: false
        }
      ],
      status: 'active'
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/workflows`,
      workflow,
      { headers: getHeaders() }
    );
    
    workflowId = response.data.data.workflow.id;
    console.log('工作流创建成功，ID:', workflowId);
    console.log('工作流名称:', response.data.data.workflow.name);
    return true;
  } catch (error) {
    console.error('创建工作流失败:', error.response?.data || error.message);
    return false;
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
      { headers: getHeaders() }
    );
    
    console.log('获取工作流定义详情成功:');
    console.log('工作流名称:', response.data.data.workflow.name);
    console.log('工作流类型:', response.data.data.workflow.type);
    console.log('节点数量:', response.data.data.nodes.length);
    console.log('连线数量:', response.data.data.edges.length);
    console.log('实例统计:', response.data.data.stats);
    
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
    
    const now = moment();
    const instance = {
      title: '请假申请 - ' + now.format('YYYY-MM-DD'),
      formData: {
        leaveType: '年假',
        startDate: now.format('YYYY-MM-DD'),
        endDate: now.add(2, 'days').format('YYYY-MM-DD'),
        reason: '家庭事务',
        contactInfo: '13800138000'
      }
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/workflows/${workflowId}/instances`,
      instance,
      { headers: getHeaders() }
    );
    
    instanceId = response.data.data.instance.id;
    console.log('工作流实例启动成功，ID:', instanceId);
    
    // 获取第一个任务ID
    if (response.data.data.task) {
      taskId = response.data.data.task.id;
      console.log('创建的第一个任务ID:', taskId);
    }
    
    return true;
  } catch (error) {
    console.error('启动工作流实例失败:', error.response?.data || error.message);
    return false;
  }
};

// 获取工作流实例列表测试
const testGetWorkflowInstances = async () => {
  try {
    console.log('\n测试获取工作流实例列表...');
    
    const response = await axios.get(
      `${API_BASE_URL}/workflows/instances`,
      { headers: getHeaders() }
    );
    
    console.log('获取工作流实例列表成功，总数:', response.data.data.length);
    
    // 如果之前没有创建实例，使用第一个实例的ID
    if (!instanceId && response.data.data.length > 0) {
      instanceId = response.data.data[0].id;
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
    
    const response = await axios.get(
      `${API_BASE_URL}/workflows/instances/${instanceId}`,
      { headers: getHeaders() }
    );
    
    console.log('获取工作流实例详情成功:');
    console.log('实例标题:', response.data.data.title);
    console.log('实例状态:', response.data.data.status);
    console.log('发起人:', response.data.data.initiator.name);
    console.log('当前节点:', response.data.data.currentNodeId);
    console.log('待处理任务数:', response.data.data.pendingTasks.length);
    
    // 如果有待处理任务，获取第一个任务ID
    if (!taskId && response.data.data.pendingTasks.length > 0) {
      taskId = response.data.data.pendingTasks[0].id;
      console.log('获取到待处理任务ID:', taskId);
    }
    
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
      { headers: getHeaders() }
    );
    
    console.log('获取待办任务列表成功，总数:', response.data.data.length);
    console.log('逾期任务数量:', response.data.overdueCount);
    
    // 如果之前没有获取任务，使用第一个任务的ID
    if (!taskId && response.data.data.length > 0) {
      taskId = response.data.data[0].id;
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
  if (!taskId) {
    console.log('\n跳过处理任务测试：没有可处理的任务');
    return false;
  }
  
  try {
    console.log('\n测试处理任务...');
    
    const taskProcess = {
      action: 'approve', // approve, reject, complete
      comment: '同意请假申请',
      formData: {
        // 可以提供额外的表单数据
        approverComment: '批准，注意按时销假'
      }
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/workflows/tasks/${taskId}/process`,
      taskProcess,
      { headers: getHeaders() }
    );
    
    console.log('任务处理成功:');
    console.log('任务结果:', response.data.data.processResult);
    console.log('处理人:', response.data.data.processor?.name);
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
    
    // 创建一个新的实例用于测试取消
    const now = moment();
    const instance = {
      title: '测试取消的请假申请 - ' + now.format('YYYY-MM-DD'),
      formData: {
        leaveType: '事假',
        startDate: now.format('YYYY-MM-DD'),
        endDate: now.add(1, 'days').format('YYYY-MM-DD'),
        reason: '临时有事',
        contactInfo: '13900139000'
      }
    };
    
    const createResponse = await axios.post(
      `${API_BASE_URL}/workflows/${workflowId}/instances`,
      instance,
      { headers: getHeaders() }
    );
    
    const testInstanceId = createResponse.data.data.instance.id;
    console.log('创建测试实例成功，ID:', testInstanceId);
    
    // 取消实例
    const cancelResponse = await axios.post(
      `${API_BASE_URL}/workflows/instances/${testInstanceId}/cancel`,
      { reason: '测试取消功能' },
      { headers: getHeaders() }
    );
    
    console.log('工作流实例取消成功');
    
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
    
    // 先获取当前工作流详情
    const getResponse = await axios.get(
      `${API_BASE_URL}/workflows/${workflowId}`,
      { headers: getHeaders() }
    );
    
    const currentWorkflow = getResponse.data.data.workflow;
    
    // 更新工作流
    const updatedWorkflow = {
      name: currentWorkflow.name + ' (已更新)',
      description: currentWorkflow.description + ' - 添加了更多描述',
      status: currentWorkflow.status
    };
    
    const response = await axios.put(
      `${API_BASE_URL}/workflows/${workflowId}`,
      updatedWorkflow,
      { headers: getHeaders() }
    );
    
    console.log('工作流更新成功:');
    console.log('新名称:', response.data.data.workflow.name);
    console.log('新描述:', response.data.data.workflow.description);
    
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