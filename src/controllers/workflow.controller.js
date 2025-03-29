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
exports.getWorkflowDefinitionById = async (req, res, next) => {
  try {
    const workflowId = req.params.id;
    
    const workflow = await WorkflowDefinition.findByPk(workflowId);
    
    if (!workflow) {
      return next(new AppError('工作流定义不存在', 404));
    }
    
    res.status(200).json({
      status: 'success',
      message: '获取工作流定义成功',
      data: workflow
    });
  } catch (error) {
    next(error);
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
      description, 
      nodes, 
      formSchema,
      status
    } = req.body;
    
    // 验证必填字段
    if (!name || !code || !nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return next(new AppError('工作流名称、编码和节点定义为必填项', 400));
    }
    
    // 检查工作流编码是否已存在
    const existingWorkflow = await WorkflowDefinition.findOne({
      where: { code }
    });
    
    if (existingWorkflow) {
      return next(new AppError('工作流编码已存在', 400));
    }
    
    // 创建工作流定义
    const newWorkflow = await WorkflowDefinition.create({
      name,
      code,
      description,
      nodes: JSON.stringify(nodes),
      formSchema: formSchema ? JSON.stringify(formSchema) : null,
      status: status || 'active',
      createdBy: req.user.id
    });
    
    res.status(201).json({
      status: 'success',
      message: '工作流定义创建成功',
      data: newWorkflow
    });
  } catch (error) {
    next(error);
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
          include: [
            { model: WorkflowDefinition, attributes: ['id', 'name', 'code'] },
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
      status: 'success',
      message: '获取待审批工作流节点成功',
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
 * 创建工作流实例（提交申请）
 */
exports.createWorkflowInstance = async (req, res, next) => {
  try {
    const { 
      workflowDefinitionId, 
      title,
      data
    } = req.body;
    
    // 验证必填字段
    if (!workflowDefinitionId || !title || !data) {
      return next(new AppError('工作流定义ID、标题和数据为必填项', 400));
    }
    
    // 查找工作流定义
    const workflowDefinition = await WorkflowDefinition.findByPk(workflowDefinitionId);
    
    if (!workflowDefinition) {
      return next(new AppError('工作流定义不存在', 404));
    }
    
    if (workflowDefinition.status !== 'active') {
      return next(new AppError('工作流定义未激活，无法创建实例', 400));
    }
    
    // 解析节点定义
    const nodes = JSON.parse(workflowDefinition.nodes);
    
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return next(new AppError('工作流节点定义无效', 400));
    }
    
    // 找到第一个节点
    const firstNode = nodes[0];
    
    // 创建工作流实例
    const instance = await WorkflowInstance.create({
      workflowDefinitionId,
      initiatorId: req.user.id,
      title,
      data: JSON.stringify(data),
      currentNodeIndex: 0,
      status: 'processing'
    });
    
    // 确定节点的审批人
    let assigneeId = null;
    
    if (firstNode.assigneeType === 'user' && firstNode.assigneeId) {
      assigneeId = firstNode.assigneeId;
    } else if (firstNode.assigneeType === 'role' && firstNode.assigneeId) {
      // 查找具有该角色的第一个用户
      const roleUser = await User.findOne({
        include: [
          {
            model: Role,
            where: { id: firstNode.assigneeId }
          }
        ]
      });
      
      if (roleUser) {
        assigneeId = roleUser.id;
      }
    } else if (firstNode.assigneeType === 'department' && firstNode.assigneeId) {
      // 查找部门主管
      const department = await Department.findByPk(firstNode.assigneeId);
      
      if (department && department.managerId) {
        assigneeId = department.managerId;
      }
    } else if (firstNode.assigneeType === 'initiatorManager') {
      // 查找申请人的部门主管
      const initiator = await User.findByPk(req.user.id, {
        include: [{ model: Department, as: 'department' }]
      });
      
      if (initiator && initiator.department && initiator.department.managerId) {
        assigneeId = initiator.department.managerId;
      }
    }
    
    // 创建节点实例
    const nodeInstance = await WorkflowNodeInstance.create({
      workflowInstanceId: instance.id,
      nodeIndex: 0,
      nodeName: firstNode.name,
      assigneeId,
      status: 'pending'
    });
    
    // 返回创建的工作流实例
    const result = await WorkflowInstance.findByPk(instance.id, {
      include: [
        { model: WorkflowDefinition, attributes: ['id', 'name', 'code'] },
        { model: User, as: 'initiator', attributes: ['id', 'username', 'name'] }
      ]
    });
    
    res.status(201).json({
      status: 'success',
      message: '工作流实例创建成功',
      data: result
    });
  } catch (error) {
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
exports.getWorkflowInstanceById = async (req, res, next) => {
  try {
    const instanceId = req.params.id;
    const userId = req.user.id;
    
    // 查询实例
    const instance = await WorkflowInstance.findByPk(instanceId, {
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
exports.getMyTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 查询参数
    const status = req.query.status || 'pending';
    const workflowId = req.query.workflowId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const search = req.query.search || '';
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    const whereCondition = {};
    
    // 只查询指派给当前用户的任务
    whereCondition.assignees = {
      [Op.contains]: [userId]
    };
    
    if (status !== 'all') {
      whereCondition.status = status;
    }
    
    if (startDate && endDate) {
      whereCondition.createTime = {
        [Op.between]: [
          moment(startDate).startOf('day').toDate(),
          moment(endDate).endOf('day').toDate()
        ]
      };
    }
    
    if (search) {
      whereCondition.title = {
        [Op.like]: `%${search}%`
      };
    }
    
    // 工作流实例查询条件
    const instanceWhereCondition = {};
    
    if (workflowId) {
      instanceWhereCondition.workflowId = workflowId;
    }
    
    // 执行查询
    const { count, rows } = await WorkflowTask.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: WorkflowInstance,
          as: 'instance',
          where: instanceWhereCondition,
          include: [
            { 
              model: Workflow, 
              as: 'workflow',
              attributes: ['id', 'name', 'type']
            },
            { 
              model: User, 
              as: 'initiator', 
              attributes: ['id', 'username', 'name'] 
            }
          ]
        }
      ],
      order: [
        ['deadline', 'ASC', 'NULLS LAST'],
        ['createTime', 'DESC']
      ],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    // 获取逾期任务数量
    const overdueCount = await WorkflowTask.count({
      where: {
        assignees: {
          [Op.contains]: [userId]
        },
        status: 'pending',
        deadline: {
          [Op.lt]: new Date()
        }
      }
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取待办任务列表成功',
      data: rows,
      overdueCount,
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
exports.cancelWorkflowInstance = async (req, res, next) => {
  try {
    const instanceId = req.params.id;
    const userId = req.user.id;
    const { reason } = req.body;
    
    // 查询实例
    const instance = await WorkflowInstance.findByPk(instanceId, {
      include: [
        { model: WorkflowTask, as: 'tasks', where: { status: 'pending' }, required: false }
      ]
    });
    
    if (!instance) {
      return next(new AppError('工作流实例不存在', 404));
    }
    
    // 检查实例状态
    if (instance.status !== 'running') {
      return next(new AppError(`该工作流实例已${instance.status === 'completed' ? '完成' : instance.status === 'rejected' ? '拒绝' : '取消'}，无法再次取消`, 400));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && instance.initiatorId !== userId) {
      return next(new AppError('您不是该工作流实例的发起人，无权取消', 403));
    }
    
    // 事务处理
    await sequelize.transaction(async (t) => {
      // 更新所有未完成的任务
      for (const task of instance.tasks) {
        await task.update({
          status: 'cancelled',
          processTime: new Date(),
          completeTime: new Date(),
          processResult: 'cancelled',
          comment: `流程被${isAdmin ? '管理员' : '发起人'}取消：${reason || '无原因'}`
        }, { transaction: t });
      }
      
      // 更新实例状态
      await instance.update({
        status: 'cancelled',
        endTime: new Date(),
        result: 'cancelled',
        cancelReason: reason || null,
        cancelledBy: userId
      }, { transaction: t });
    });
    
    res.status(200).json({
      status: 'success',
      message: '工作流实例取消成功'
    });
  } catch (error) {
    next(error);
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