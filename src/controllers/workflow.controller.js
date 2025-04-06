const { 
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNodeInstance,
  User,
  Department,
  Role,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowTask
} = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');
const sequelize = require('sequelize');
const logger = require('../utils/logger');

/**
 * 获取所有工作流定义
 */
exports.getAllWorkflowDefinitions = async (req, res, next) => {
  try {
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 搜索参数
    const search = req.query.search || '';
    const status = req.query.status;
    
    // 构建查询条件
    const whereCondition = {};
    
    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    // 执行查询
    const { count, rows } = await WorkflowDefinition.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取工作流定义列表成功',
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 根据ID获取工作流定义
 */
exports.getWorkflowDefinitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const definition = await WorkflowDefinition.findByPk(id, {
      include: [{
        model: WorkflowInstance,
        as: 'workflowInstances',
        attributes: ['id', 'status', 'startTime', 'endTime']
      }]
    });

    if (!definition) {
      return res.status(404).json({
        status: 'error',
        message: '工作流定义不存在'
      });
    }

    res.json({
      status: 'success',
      data: definition
    });
  } catch (error) {
    logger.error('获取工作流定义详情失败:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * 创建工作流定义
 */
exports.createWorkflowDefinition = async (req, res, next) => {
  try {
    const { 
      name, 
      code, 
      category,
      description, 
      nodeConfig, 
      formConfig,
      status
    } = req.body;
    
    logger.info('开始创建工作流定义', { name, code, category });
    
    // 验证必填字段
    if (!name || !code || !category || !nodeConfig) {
      logger.warn('工作流定义缺少必填字段', { name, code, category });
      return res.status(400).json({
        status: 'error',
        message: '工作流名称、编码、类别和节点定义为必填项'
      });
    }
    
    // 验证nodeConfig的结构
    let parsedNodeConfig;
    try {
      parsedNodeConfig = typeof nodeConfig === 'string' ? JSON.parse(nodeConfig) : nodeConfig;
    } catch (error) {
      logger.warn('工作流节点配置解析失败', { error: error.message });
      return res.status(400).json({
        status: 'error',
        message: '工作流节点配置格式无效'
      });
    }

    if (!parsedNodeConfig.nodes || !Array.isArray(parsedNodeConfig.nodes) || parsedNodeConfig.nodes.length === 0) {
      logger.warn('工作流节点配置无效', { nodeConfig: parsedNodeConfig });
      return res.status(400).json({
        status: 'error',
        message: '工作流节点配置无效，必须包含至少一个节点'
      });
    }

    // 验证每个节点的必要属性
    for (const node of parsedNodeConfig.nodes) {
      if (!node.id || !node.type || !node.name) {
        logger.warn('工作流节点缺少必要属性', { node });
        return res.status(400).json({
          status: 'error',
          message: '工作流节点缺少必要属性（id、type、name）'
        });
      }
    }

    if (!parsedNodeConfig.edges || !Array.isArray(parsedNodeConfig.edges)) {
      logger.warn('工作流边配置无效', { nodeConfig: parsedNodeConfig });
      return res.status(400).json({
        status: 'error',
        message: '工作流边配置无效'
      });
    }

    // 验证每个边的必要属性
    for (const edge of parsedNodeConfig.edges) {
      if (!edge.source || !edge.target) {
        logger.warn('工作流边缺少必要属性', { edge });
        return res.status(400).json({
          status: 'error',
          message: '工作流边缺少必要属性（source、target）'
        });
      }
    }
    
    // 检查工作流编码是否已存在
    const existingWorkflow = await WorkflowDefinition.findOne({
      where: { code }
    });
    
    if (existingWorkflow) {
      logger.warn('工作流编码已存在', { code });
      return res.status(400).json({
        status: 'error',
        message: '工作流编码已存在'
      });
    }
    
    // 创建工作流定义
    const newWorkflow = await WorkflowDefinition.create({
      name,
      code,
      category,
      description,
      nodeConfig: parsedNodeConfig,
      formConfig: formConfig || null,
      status: status || 'active',
      createdBy: req.user ? req.user.id : null
    });
    
    logger.info('工作流定义创建成功', { id: newWorkflow.id });
    
    res.status(201).json({
      status: 'success',
      message: '工作流定义创建成功',
      data: newWorkflow
    });
  } catch (error) {
    logger.error('创建工作流定义失败', { 
      error: error.message, 
      stack: error.stack,
      body: req.body 
    });
    res.status(500).json({
      status: 'error',
      message: '服务器内部错误',
      error: error.message
    });
  }
};

/**
 * 更新工作流定义
 */
exports.updateWorkflowDefinition = async (req, res, next) => {
  try {
    const workflowId = req.params.id;
    const { 
      name, 
      description, 
      nodes, 
      formSchema,
      status
    } = req.body;
    
    // 查找工作流定义
    const workflow = await WorkflowDefinition.findByPk(workflowId);
    
    if (!workflow) {
      return next(new AppError('工作流定义不存在', 404));
    }
    
    // 更新工作流定义
    const updateData = {};
    
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (nodes) updateData.nodes = JSON.stringify(nodes);
    if (formSchema) updateData.formSchema = JSON.stringify(formSchema);
    if (status) updateData.status = status;
    
    // 如果工作流已经有实例，不允许修改节点定义
    if (nodes) {
      const hasInstances = await WorkflowInstance.count({
        where: { 
          workflowDefinitionId: workflowId,
          status: { [Op.notIn]: ['completed', 'rejected', 'cancelled'] }
        }
      });
      
      if (hasInstances > 0) {
        return next(new AppError('无法修改存在活动实例的工作流节点定义', 400));
      }
    }
    
    await workflow.update(updateData);
    
    res.status(200).json({
      status: 'success',
      message: '工作流定义更新成功',
      data: await WorkflowDefinition.findByPk(workflowId)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除工作流定义
 */
exports.deleteWorkflowDefinition = async (req, res, next) => {
  try {
    const workflowId = req.params.id;
    
    // 查找工作流定义
    const workflow = await WorkflowDefinition.findByPk(workflowId);
    
    if (!workflow) {
      return next(new AppError('工作流定义不存在', 404));
    }
    
    // 检查是否有工作流实例
    const hasInstances = await WorkflowInstance.count({
      where: { workflowDefinitionId: workflowId }
    });
    
    if (hasInstances > 0) {
      return next(new AppError('不能删除已有实例的工作流定义', 400));
    }
    
    // 删除工作流定义
    await workflow.destroy();
    
    res.status(200).json({
      status: 'success',
      message: '工作流定义删除成功'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我创建的工作流实例
 */
exports.getMyWorkflowInstances = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 状态过滤
    const status = req.query.status;
    const whereCondition = { initiatorId: userId };
    
    if (status) {
      whereCondition.status = status;
    }
    
    // 执行查询
    const { count, rows } = await WorkflowInstance.findAndCountAll({
      where: whereCondition,
      include: [
        { model: WorkflowDefinition, attributes: ['id', 'name', 'code'] },
        { model: User, as: 'initiator', attributes: ['id', 'username', 'name'] }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取我的工作流实例成功',
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取待我审批的工作流节点
 */
exports.getMyPendingApprovals = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 执行查询
    const { count, rows } = await WorkflowNodeInstance.findAndCountAll({
      where: {
        assigneeId: userId,
        status: 'pending'
      },
      include: [
        { 
          model: WorkflowInstance,
          as: 'workflowInstance',
          include: [
            { model: WorkflowDefinition, as: 'workflowDefinition', attributes: ['id', 'name', 'code'] },
            { model: User, as: 'initiator', attributes: ['id', 'username', 'name'] }
          ]
        }
      ],
      limit,
      offset,
      order: [['createdAt', 'ASC']]
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      success: true,
      data: {
        items: rows,
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 创建工作流实例
 */
exports.createWorkflowInstance = async (req, res, next) => {
  const transaction = await WorkflowDefinition.sequelize.transaction();
  
  try {
    const { workflowDefinitionId, title, formData } = req.body;

    // 验证必填字段
    if (!workflowDefinitionId || !title || !formData) {
      return next(new AppError('工作流定义ID、标题和表单数据为必填项', 400));
    }

    // 验证formData是否为有效的JSON对象
    let parsedFormData;
    try {
      parsedFormData = typeof formData === 'string' ? JSON.parse(formData) : formData;
      if (typeof parsedFormData !== 'object' || parsedFormData === null) {
        throw new Error('表单数据必须是一个对象');
      }
    } catch (error) {
      return next(new AppError('表单数据格式无效：' + error.message, 400));
    }

    // 查找工作流定义
    const workflowDefinition = await WorkflowDefinition.findByPk(workflowDefinitionId, {
      include: [{
        model: WorkflowInstance,
        as: 'workflowInstances'
      }]
    });

    if (!workflowDefinition) {
      return next(new AppError('工作流定义不存在', 404));
    }

    if (workflowDefinition.status !== 'active') {
      return next(new AppError('工作流定义未激活', 400));
    }

    // 解析节点配置
    let nodeConfig;
    try {
      nodeConfig = typeof workflowDefinition.nodeConfig === 'string' 
        ? JSON.parse(workflowDefinition.nodeConfig)
        : workflowDefinition.nodeConfig;
    } catch (error) {
      return next(new AppError('工作流节点配置解析失败', 400));
    }

    if (!nodeConfig || !nodeConfig.nodes || !nodeConfig.nodes.length) {
      return next(new AppError('工作流节点配置无效', 400));
    }

    // 验证formData是否符合formConfig配置
    let formConfig;
    try {
      formConfig = typeof workflowDefinition.formConfig === 'string' 
        ? JSON.parse(workflowDefinition.formConfig)
        : workflowDefinition.formConfig;
    } catch (error) {
      return next(new AppError('表单配置解析失败', 400));
    }

    if (!formConfig || !formConfig.properties) {
      return next(new AppError('表单配置无效', 400));
    }

    // 验证必填字段
    const requiredFields = Object.entries(formConfig.properties)
      .filter(([_, field]) => field.required)
      .map(([name]) => name);

    const missingFields = requiredFields.filter(field => !parsedFormData.hasOwnProperty(field));
    if (missingFields.length > 0) {
      return next(new AppError(`缺少必填字段: ${missingFields.join(', ')}`, 400));
    }

    // 创建工作流实例
    const workflowInstance = await WorkflowInstance.create({
      workflowDefinitionId,
      title,
      formData: parsedFormData,
      currentNode: nodeConfig.nodes[0].id,
      status: 'processing',
      initiatorId: req.user.id,
      startTime: new Date()
    }, { transaction });

    // 创建第一个节点实例
    const firstNode = nodeConfig.nodes[0];
    let assigneeId = null;

    // 根据节点配置确定审批人
    if (firstNode.type === 'start' || firstNode.type === 'end') {
      // 开始和结束节点不需要审批人
      assigneeId = null;
    } else if (firstNode.assigneeType === 'user') {
      assigneeId = firstNode.assigneeId;
    } else if (firstNode.assigneeType === 'role') {
      const role = await Role.findByPk(firstNode.assigneeId);
      if (role) {
        const users = await role.getUsers();
        if (users.length > 0) {
          assigneeId = users[0].id;
        }
      }
    } else if (firstNode.assigneeType === 'department') {
      const department = await Department.findByPk(firstNode.assigneeId);
      if (department) {
        const users = await department.getUsers();
        if (users.length > 0) {
          assigneeId = users[0].id;
        }
      }
    } else if (firstNode.assigneeType === 'initiator') {
      assigneeId = req.user.id;
    }

    // 创建节点实例
    await WorkflowNodeInstance.create({
      workflowInstanceId: workflowInstance.id,
      workflowDefinitionId: workflowDefinitionId,
      nodeId: firstNode.id,
      nodeName: firstNode.name,
      nodeType: firstNode.type,
      assigneeType: firstNode.type === 'start' || firstNode.type === 'end' ? null : firstNode.assigneeType,
      assigneeId,
      status: firstNode.type === 'start' ? 'completed' : 'pending',
      startTime: new Date(),
      order: 0
    }, { transaction });

    // 提交事务
    await transaction.commit();

    // 返回创建的工作流实例
    const createdInstance = await WorkflowInstance.findByPk(workflowInstance.id, {
      include: [{
        model: WorkflowDefinition,
        as: 'workflowDefinition',
        attributes: ['name', 'code', 'category']
      }]
    });

    res.status(201).json({
      status: 'success',
      message: '工作流实例创建成功',
      data: createdInstance
    });
  } catch (error) {
    // 回滚事务
    await transaction.rollback();
    next(error);
  }
};

/**
 * 审批工作流节点
 */
exports.approveWorkflowNode = async (req, res, next) => {
  try {
    const nodeInstanceId = req.params.id;
    const { comment, action } = req.body;
    
    // 验证操作
    if (action !== 'approve' && action !== 'reject') {
      return next(new AppError('无效的操作，只能是approve或reject', 400));
    }
    
    // 查找节点实例
    const nodeInstance = await WorkflowNodeInstance.findByPk(nodeInstanceId, {
      include: [
        { model: WorkflowInstance }
      ]
    });
    
    if (!nodeInstance) {
      return next(new AppError('工作流节点实例不存在', 404));
    }
    
    // 检查节点状态
    if (nodeInstance.status !== 'pending') {
      return next(new AppError('该节点已处理，无法重复操作', 400));
    }
    
    // 检查当前用户是否为该节点的审批人
    if (nodeInstance.assigneeId !== req.user.id) {
      return next(new AppError('您不是该节点的审批人，无权操作', 403));
    }
    
    // 获取工作流实例
    const instance = nodeInstance.WorkflowInstance;
    
    // 获取工作流定义
    const workflowDefinition = await WorkflowDefinition.findByPk(instance.workflowDefinitionId);
    
    // 解析节点定义
    const nodes = JSON.parse(workflowDefinition.nodes);
    
    // 更新节点实例状态
    await nodeInstance.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      comment: comment || null,
      completedAt: new Date()
    });
    
    // 如果拒绝，直接更新工作流实例状态为拒绝
    if (action === 'reject') {
      await instance.update({
        status: 'rejected',
        completedAt: new Date()
      });
      
      return res.status(200).json({
        status: 'success',
        message: '工作流节点已拒绝',
        data: {
          nodeInstance: await WorkflowNodeInstance.findByPk(nodeInstanceId),
          workflowInstance: await WorkflowInstance.findByPk(instance.id)
        }
      });
    }
    
    // 如果通过，检查是否有下一个节点
    const currentNodeIndex = instance.currentNodeIndex;
    const nextNodeIndex = currentNodeIndex + 1;
    
    // 如果已经是最后一个节点，更新工作流实例状态为完成
    if (nextNodeIndex >= nodes.length) {
      await instance.update({
        status: 'completed',
        completedAt: new Date()
      });
      
      return res.status(200).json({
        status: 'success',
        message: '工作流已完成',
        data: {
          nodeInstance: await WorkflowNodeInstance.findByPk(nodeInstanceId),
          workflowInstance: await WorkflowInstance.findByPk(instance.id)
        }
      });
    }
    
    // 获取下一个节点定义
    const nextNode = nodes[nextNodeIndex];
    
    // 更新工作流实例的当前节点索引
    await instance.update({
      currentNodeIndex: nextNodeIndex
    });
    
    // 确定下一个节点的审批人
    let assigneeId = null;
    
    if (nextNode.assigneeType === 'user' && nextNode.assigneeId) {
      assigneeId = nextNode.assigneeId;
    } else if (nextNode.assigneeType === 'role' && nextNode.assigneeId) {
      // 查找具有该角色的第一个用户
      const roleUser = await User.findOne({
        include: [
          {
            model: Role,
            where: { id: nextNode.assigneeId }
          }
        ]
      });
      
      if (roleUser) {
        assigneeId = roleUser.id;
      }
    } else if (nextNode.assigneeType === 'department' && nextNode.assigneeId) {
      // 查找部门主管
      const department = await Department.findByPk(nextNode.assigneeId);
      
      if (department && department.managerId) {
        assigneeId = department.managerId;
      }
    } else if (nextNode.assigneeType === 'initiatorManager') {
      // 查找申请人的部门主管
      const initiator = await User.findByPk(instance.initiatorId, {
        include: [{ model: Department, as: 'department' }]
      });
      
      if (initiator && initiator.department && initiator.department.managerId) {
        assigneeId = initiator.department.managerId;
      }
    }
    
    // 创建下一个节点实例
    const nextNodeInstance = await WorkflowNodeInstance.create({
      workflowInstanceId: instance.id,
      nodeIndex: nextNodeIndex,
      nodeName: nextNode.name,
      assigneeId,
      status: 'pending'
    });
    
    res.status(200).json({
      status: 'success',
      message: '工作流节点已通过，已创建下一个节点',
      data: {
        currentNodeInstance: await WorkflowNodeInstance.findByPk(nodeInstanceId),
        nextNodeInstance,
        workflowInstance: await WorkflowInstance.findByPk(instance.id)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取工作流实例详情
 */
exports.getWorkflowInstanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // 查询实例
    const instance = await WorkflowInstance.findByPk(id, {
      include: [
        { 
          model: Workflow, 
          as: 'workflow',
          include: [
            { model: WorkflowNode, as: 'nodes' },
            { model: WorkflowEdge, as: 'edges' }
          ]
        },
        { 
          model: User, 
          as: 'initiator', 
          attributes: ['id', 'username', 'name'] 
        },
        {
          model: WorkflowTask,
          as: 'tasks',
          include: [
            { 
              model: User, 
              as: 'processor', 
              attributes: ['id', 'username', 'name'] 
            }
          ],
          order: [['createTime', 'ASC']]
        }
      ]
    });
    
    if (!instance) {
      return next(new AppError('工作流实例不存在', 404));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isInitiator = instance.initiatorId === userId;
    
    // 检查是否是任务处理人之一
    const isTaskAssignee = instance.tasks.some(task => {
      return task.assignees.includes(userId);
    });
    
    if (!isAdmin && !isInitiator && !isTaskAssignee) {
      return next(new AppError('您没有权限查看此工作流实例', 403));
    }
    
    // 构建工作流状态历史
    const statusHistory = [];
    
    // 启动记录
    statusHistory.push({
      time: instance.startTime,
      status: 'started',
      node: instance.workflow.nodes.find(node => node.type === 'start')?.label || '开始',
      processor: instance.initiator.name,
      comment: '发起流程'
    });
    
    // 任务处理记录
    instance.tasks.forEach(task => {
      if (task.status === 'completed' || task.status === 'rejected') {
        const node = instance.workflow.nodes.find(node => node.nodeId === task.nodeId);
        statusHistory.push({
          time: task.completeTime,
          status: task.status,
          node: node?.label || task.title,
          processor: task.processor?.name || '系统',
          comment: task.comment || ''
        });
      }
    });
    
    // 如果流程结束，添加结束记录
    if (instance.status === 'completed' || instance.status === 'cancelled') {
      statusHistory.push({
        time: instance.endTime,
        status: instance.status,
        node: instance.workflow.nodes.find(node => node.type === 'end')?.label || '结束',
        processor: instance.status === 'cancelled' ? (instance.cancelledBy ? (await User.findByPk(instance.cancelledBy))?.name : '系统') : '系统',
        comment: instance.status === 'cancelled' ? '流程被取消' : '流程正常结束'
      });
    }
    
    // 按时间排序
    statusHistory.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // 找出当前待处理的任务
    const pendingTasks = instance.tasks.filter(task => task.status === 'pending');
    
    // 添加待处理任务的处理人信息
    const pendingTasksWithAssignees = await Promise.all(
      pendingTasks.map(async (task) => {
        const assigneeUsers = await User.findAll({
          where: {
            id: {
              [Op.in]: task.assignees
            }
          },
          attributes: ['id', 'username', 'name']
        });
        
        return {
          ...task.toJSON(),
          assigneeUsers
        };
      })
    );
    
    // 构建实例详情
    const instanceDetail = {
      ...instance.toJSON(),
      statusHistory,
      pendingTasks: pendingTasksWithAssignees,
      canProcess: isAdmin || pendingTasks.some(task => task.assignees.includes(userId)),
      canCancel: (isAdmin || isInitiator) && instance.status === 'running'
    };
    
    res.status(200).json({
      status: 'success',
      message: '获取工作流实例详情成功',
      data: instanceDetail
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取待办任务列表
 */
exports.getTodoTasks = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const tasks = await WorkflowNodeInstance.findAndCountAll({
      where: {
        assigneeId: userId,
        status: 'pending'
      },
      include: [{
        model: WorkflowInstance,
        as: 'workflowInstance',
        required: false,
        include: [{
          model: WorkflowDefinition,
          as: 'definition',
          required: false,
          attributes: ['name', 'code', 'category']
        }, {
          model: User,
          as: 'initiator',
          required: false,
          attributes: ['id', 'username', 'name']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      status: 'success',
      data: {
        total: tasks.count,
        items: tasks.rows
      }
    });
  } catch (error) {
    logger.error('获取待办任务列表失败:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * 处理任务
 */
exports.processTask = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    const { action, comment, formData } = req.body;
    
    // 验证操作
    if (!action || !['approve', 'reject', 'complete'].includes(action)) {
      return next(new AppError('无效的操作，只能是approve、reject或complete', 400));
    }
    
    // 查询任务
    const task = await WorkflowTask.findByPk(taskId, {
      include: [
        {
          model: WorkflowInstance,
          as: 'instance',
          include: [
            { 
              model: Workflow, 
              as: 'workflow',
              include: [
                { model: WorkflowNode, as: 'nodes' },
                { model: WorkflowEdge, as: 'edges' }
              ]
            }
          ]
        }
      ]
    });
    
    if (!task) {
      return next(new AppError('任务不存在', 404));
    }
    
    // 检查任务状态
    if (task.status !== 'pending') {
      return next(new AppError(`该任务已${task.status === 'completed' ? '完成' : '拒绝'}，无法再次处理`, 400));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && !task.assignees.includes(userId)) {
      return next(new AppError('您不是该任务的处理人，无权操作', 403));
    }
    
    // 查找当前节点
    const currentNode = task.instance.workflow.nodes.find(
      node => node.nodeId === task.nodeId
    );
    
    if (!currentNode) {
      return next(new AppError('工作流定义错误：找不到当前节点', 500));
    }
    
    // 事务处理
    await sequelize.transaction(async (t) => {
      // 更新任务
      await task.update({
        status: action === 'reject' ? 'rejected' : 'completed',
        processTime: new Date(),
        completeTime: new Date(),
        processResult: action,
        comment: comment || null,
        formData: formData || task.formData,
        processorId: userId
      }, { transaction: t });
      
      // 如果拒绝，结束工作流实例
      if (action === 'reject') {
        await task.instance.update({
          status: 'rejected',
          endTime: new Date(),
          result: 'rejected',
          endNodeId: task.nodeId
        }, { transaction: t });
        
        return;
      }
      
      // 确定下一个节点
      let nextNode = null;
      let nextEdge = null;
      
      // 如果是条件节点，根据条件确定下一个节点
      if (currentNode.type === 'condition') {
        // 获取所有从当前节点出发的边
        const outgoingEdges = task.instance.workflow.edges.filter(
          edge => edge.source === currentNode.nodeId
        );
        
        // 计算条件
        for (const edge of outgoingEdges) {
          if (!edge.condition) {
            // 没有条件的边作为默认路径
            nextEdge = edge;
            break;
          }
          
          // 简单条件解析，实际应用中可能需要更复杂的条件解析器
          try {
            const conditionMet = evalCondition(edge.condition, task.instance.formData, task.instance.variables);
            if (conditionMet) {
              nextEdge = edge;
              break;
            }
          } catch (err) {
            console.error('条件解析错误:', err);
          }
        }
      } else {
        // 非条件节点，获取唯一的出边
        nextEdge = task.instance.workflow.edges.find(
          edge => edge.source === currentNode.nodeId
        );
      }
      
      if (!nextEdge) {
        return next(new AppError('工作流定义错误：找不到下一个连线', 500));
      }
      
      // 获取下一个节点
      nextNode = task.instance.workflow.nodes.find(
        node => node.nodeId === nextEdge.target
      );
      
      if (!nextNode) {
        return next(new AppError('工作流定义错误：找不到下一个节点', 500));
      }
      
      // 更新实例的当前节点
      await task.instance.update({
        currentNodeId: nextNode.nodeId,
        variables: {
          ...task.instance.variables,
          ...task.formData // 将任务表单数据合并到变量中
        }
      }, { transaction: t });
      
      // 如果下一个节点是结束节点
      if (nextNode.type === 'end') {
        await task.instance.update({
          status: 'completed',
          endTime: new Date(),
          result: 'completed',
          endNodeId: nextNode.nodeId
        }, { transaction: t });
        
        return;
      }
      
      // 创建下一个任务
      let assignees = [];
      
      // 根据节点类型和配置确定处理人
      if (nextNode.type === 'approval') {
        // 审批节点，查找审批人
        const approvers = nextNode.approvers || [];
        
        for (const approver of approvers) {
          if (approver.type === 'user') {
            // 指定用户
            assignees.push(approver.id);
          } else if (approver.type === 'role') {
            // 指定角色
            const roleUsers = await User.findAll({
              include: [{
                model: Role,
                where: { id: approver.id }
              }],
              attributes: ['id']
            });
            
            assignees = assignees.concat(roleUsers.map(user => user.id));
          } else if (approver.type === 'department') {
            // 指定部门
            const deptUsers = await User.findAll({
              where: { departmentId: approver.id },
              attributes: ['id']
            });
            
            assignees = assignees.concat(deptUsers.map(user => user.id));
          } else if (approver.type === 'initiator_supervisor') {
            // 申请人的上级
            const initiator = await User.findByPk(task.instance.initiatorId, {
              include: [{ model: Department, as: 'department' }]
            });
            
            if (initiator && initiator.department && initiator.department.managerId) {
              assignees.push(initiator.department.managerId);
            }
          } else if (approver.type === 'previous_processor_supervisor') {
            // 上一处理人的上级
            const processor = await User.findByPk(userId, {
              include: [{ model: Department, as: 'department' }]
            });
            
            if (processor && processor.department && processor.department.managerId) {
              assignees.push(processor.department.managerId);
            }
          }
        }
        
        // 去重
        assignees = [...new Set(assignees)];
      } else if (nextNode.type === 'task') {
        // 普通任务节点
        if (nextNode.properties && nextNode.properties.assigneeType) {
          // 根据节点属性指定处理人
          const assigneeType = nextNode.properties.assigneeType;
          
          if (assigneeType === 'initiator') {
            // 发起人
            assignees.push(task.instance.initiatorId);
          } else if (assigneeType === 'fixed_user' && nextNode.properties.assigneeId) {
            // 固定用户
            assignees.push(nextNode.properties.assigneeId);
          } else if (assigneeType === 'previous_processor') {
            // 上一处理人
            assignees.push(userId);
          } else {
            // 默认为发起人
            assignees.push(task.instance.initiatorId);
          }
        } else {
          // 默认为发起人
          assignees.push(task.instance.initiatorId);
        }
      }
      
      // 创建新任务
      await WorkflowTask.create({
        instanceId: task.instance.id,
        nodeId: nextNode.nodeId,
        title: `${nextNode.label} - ${task.instance.title}`,
        description: nextNode.properties.description || '',
        assignees,
        status: 'pending',
        createTime: new Date(),
        deadline: nextNode.properties.deadline ? new Date(Date.now() + nextNode.properties.deadline * 3600000) : null
      }, { transaction: t });
    });
    
    // 获取更新后的任务和实例
    const updatedTask = await WorkflowTask.findByPk(taskId, {
      include: [
        {
          model: WorkflowInstance,
          as: 'instance',
          include: [
            { model: Workflow, as: 'workflow' },
            { model: User, as: 'initiator' }
          ]
        },
        { model: User, as: 'processor' }
      ]
    });
    
    res.status(200).json({
      status: 'success',
      message: `任务${action === 'approve' ? '审批通过' : action === 'reject' ? '拒绝' : '完成'}成功`,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 取消工作流实例
 */
exports.cancelWorkflowInstance = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const instance = await WorkflowInstance.findByPk(id, {
      include: [{
        model: WorkflowNodeInstance,
        as: 'nodeInstances',
        where: {
          status: 'pending'
        },
        required: false
      }],
      transaction
    });

    if (!instance) {
      await transaction.rollback();
      return res.status(404).json({
        status: 'error',
        message: '工作流实例不存在'
      });
    }

    if (instance.initiatorId !== userId) {
      await transaction.rollback();
      return res.status(403).json({
        status: 'error',
        message: '只有发起人可以取消工作流'
      });
    }

    // 更新所有待处理的节点实例状态为已取消
    if (instance.nodeInstances && instance.nodeInstances.length > 0) {
      await Promise.all(instance.nodeInstances.map(nodeInstance =>
        nodeInstance.update({ 
          status: 'cancelled',
          endTime: new Date()
        }, { transaction })
      ));
    }

    // 更新工作流实例状态
    await instance.update({
      status: 'cancelled',
      endTime: new Date()
    }, { transaction });

    await transaction.commit();

    // 重新查询完整的实例信息
    const updatedInstance = await WorkflowInstance.findByPk(id, {
      include: [{
        model: WorkflowDefinition,
        as: 'definition',
        required: false,
        attributes: ['name', 'code', 'category']
      }, {
        model: WorkflowNodeInstance,
        as: 'nodeInstances',
        required: false
      }]
    });

    res.json({
      status: 'success',
      message: '工作流实例已取消',
      data: updatedInstance
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('取消工作流实例失败:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * 辅助函数：评估条件表达式
 */
function evalCondition(condition, formData, variables) {
  if (!condition) return true;
  
  // 合并表单数据和变量
  const context = { ...formData, ...variables };
  
  // 简单条件解析，支持 =, !=, >, <, >=, <= 和 AND, OR 操作
  try {
    // 创建安全的表达式求值环境
    const safeEval = (expr) => {
      // 替换变量引用
      let safeExpr = expr.replace(/\$\{([\w\.]+)\}/g, (match, p1) => {
        const value = p1.split('.').reduce((obj, prop) => obj && obj[prop], context);
        return typeof value === 'string' ? `"${value}"` : value;
      });
      
      // 替换操作符
      safeExpr = safeExpr
        .replace(/\s+AND\s+/g, ' && ')
        .replace(/\s+OR\s+/g, ' || ')
        .replace(/\s*=\s*/g, ' === ')
        .replace(/\s*!=\s*/g, ' !== ');
      
      // 使用 Function 构造函数创建函数，但不允许访问全局对象
      const fn = new Function('context', `"use strict"; return (${safeExpr});`);
      return fn(context);
    };
    
    return safeEval(condition);
  } catch (err) {
    console.error('条件解析错误:', err);
    return false;
  }
}

// 获取工作流实例列表
exports.getWorkflowInstances = async (req, res) => {
  try {
    const { workflowDefinitionId, status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (workflowDefinitionId) {
      where.workflowDefinitionId = workflowDefinitionId;
    }
    if (status) {
      where.status = status;
    }

    const instances = await WorkflowInstance.findAndCountAll({
      where,
      include: [{
        model: WorkflowDefinition,
        as: 'definition',
        required: false,
        attributes: ['name', 'code', 'category']
      }, {
        model: User,
        as: 'initiator',
        required: false,
        attributes: ['id', 'username', 'name']
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      status: 'success',
      data: {
        total: instances.count,
        items: instances.rows
      }
    });
  } catch (error) {
    logger.error('获取工作流实例列表失败:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// 获取工作流实例详情
exports.getWorkflowInstanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await WorkflowInstance.findByPk(id, {
      include: [{
        model: WorkflowDefinition,
        as: 'definition',
        required: false,
        attributes: ['name', 'code', 'category']
      }, {
        model: WorkflowNodeInstance,
        as: 'nodeInstances',
        include: [{
          model: User,
          as: 'assignee',
          required: false,
          attributes: ['id', 'username', 'name']
        }]
      }, {
        model: User,
        as: 'initiator',
        required: false,
        attributes: ['id', 'username', 'name']
      }]
    });

    if (!instance) {
      return res.status(404).json({
        status: 'error',
        message: '工作流实例不存在'
      });
    }

    res.json({
      status: 'success',
      data: instance
    });
  } catch (error) {
    logger.error('获取工作流实例详情失败:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// 启动工作流实例
exports.startWorkflowInstance = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { workflowDefinitionId, title, formData, businessKey } = req.body;
    const { userId } = req.user;

    // 获取工作流定义
    const definition = await WorkflowDefinition.findByPk(workflowDefinitionId);
    if (!definition) {
      await transaction.rollback();
      return res.status(404).json({
        status: 'error',
        message: '工作流定义不存在'
      });
    }

    // 解析节点配置
    let nodeConfig;
    try {
      nodeConfig = typeof definition.nodeConfig === 'string' 
        ? JSON.parse(definition.nodeConfig)
        : definition.nodeConfig;
    } catch (error) {
      return next(new AppError('工作流节点配置解析失败', 400));
    }

    if (!nodeConfig || !nodeConfig.nodes || !nodeConfig.nodes.length) {
      return next(new AppError('工作流节点配置无效', 400));
    }

    // 创建工作流实例
    const instance = await WorkflowInstance.create({
      workflowDefinitionId,
      title,
      formData,
      currentNode: nodeConfig.nodes[0].id,
      status: 'processing',
      startTime: new Date(),
      initiatorId: userId,
      priority: 'medium'
    }, { transaction });

    // 创建第一个节点实例
    const firstNode = nodeConfig.nodes[0];
    let assigneeId = null;

    // 根据节点配置确定审批人
    if (firstNode.type === 'start' || firstNode.type === 'end') {
      // 开始和结束节点不需要审批人
      assigneeId = null;
    } else if (firstNode.assigneeType === 'user') {
      assigneeId = firstNode.assigneeId;
    } else if (firstNode.assigneeType === 'role') {
      const role = await Role.findByPk(firstNode.assigneeId);
      if (role) {
        const users = await role.getUsers();
        if (users.length > 0) {
          assigneeId = users[0].id;
        }
      }
    } else if (firstNode.assigneeType === 'department') {
      const department = await Department.findByPk(firstNode.assigneeId);
      if (department) {
        const users = await department.getUsers();
        if (users.length > 0) {
          assigneeId = users[0].id;
        }
      }
    } else if (firstNode.assigneeType === 'initiator') {
      assigneeId = userId;
    }

    // 创建节点实例
    await WorkflowNodeInstance.create({
      workflowInstanceId: instance.id,
      workflowDefinitionId: workflowDefinitionId,
      nodeId: firstNode.id,
      nodeName: firstNode.name,
      nodeType: firstNode.type,
      assigneeType: firstNode.type === 'start' || firstNode.type === 'end' ? null : firstNode.assigneeType,
      assigneeId,
      status: firstNode.type === 'start' ? 'completed' : 'pending',
      startTime: new Date(),
      order: 0
    }, { transaction });

    // 更新工作流实例的当前节点
    await instance.update({
      currentNode: firstNode.id
    }, { transaction });

    await transaction.commit();

    // 查询完整的实例信息
    const completeInstance = await WorkflowInstance.findByPk(instance.id, {
      include: [{
        model: WorkflowDefinition,
        as: 'definition',
        attributes: ['name', 'code', 'category']
      }]
    });

    res.json({
      status: 'success',
      message: '工作流实例创建成功',
      data: completeInstance
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('启动工作流实例失败:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}; 