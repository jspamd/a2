const { Workflow, WorkflowHistory } = require('../models');

/**
 * 获取所有工作流
 */
exports.getAllWorkflows = async (req, res) => {
  try {
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 查询工作流列表
    const { count, rows } = await Workflow.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // 计算总页数
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: 'success',
      data: {
        workflows: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取工作流列表错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取工作流列表过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取单个工作流
 */
exports.getWorkflow = async (req, res) => {
  try {
    const workflowId = req.params.id;

    // 查询工作流
    const workflow = await Workflow.findByPk(workflowId, {
      include: [{ model: WorkflowHistory, order: [['createdAt', 'DESC']] }]
    });

    if (!workflow) {
      return res.status(404).json({
        status: 'error',
        message: '工作流不存在'
      });
    }

    res.status(200).json({
      status: 'success',
      data: workflow
    });
  } catch (error) {
    console.error('获取工作流错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取工作流信息过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 创建工作流
 */
exports.createWorkflow = async (req, res) => {
  try {
    const { title, type, content, attachments } = req.body;
    const userId = req.userId;

    // 创建工作流
    const workflow = await Workflow.create({
      title,
      type,
      content,
      attachments,
      createdBy: userId,
      status: 'draft'
    });

    // 记录工作流历史
    await WorkflowHistory.create({
      workflowId: workflow.id,
      action: 'create',
      userId,
      comment: '创建工作流'
    });

    res.status(201).json({
      status: 'success',
      message: '工作流创建成功',
      data: workflow
    });
  } catch (error) {
    console.error('创建工作流错误:', error);
    res.status(500).json({
      status: 'error',
      message: '创建工作流过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 更新工作流
 */
exports.updateWorkflow = async (req, res) => {
  try {
    const workflowId = req.params.id;
    const { title, content, attachments } = req.body;
    const userId = req.userId;

    // 查询工作流
    const workflow = await Workflow.findByPk(workflowId);
    if (!workflow) {
      return res.status(404).json({
        status: 'error',
        message: '工作流不存在'
      });
    }

    // 检查权限
    if (workflow.createdBy !== userId && workflow.currentHandler !== userId) {
      return res.status(403).json({
        status: 'error',
        message: '无权更新此工作流'
      });
    }

    // 检查是否处于可编辑状态
    if (workflow.status !== 'draft' && workflow.status !== 'rejected') {
      return res.status(400).json({
        status: 'error',
        message: '当前状态无法更新工作流'
      });
    }

    // 更新工作流
    await workflow.update({
      title,
      content,
      attachments
    });

    // 记录工作流历史
    await WorkflowHistory.create({
      workflowId,
      action: 'update',
      userId,
      comment: '更新工作流'
    });

    res.status(200).json({
      status: 'success',
      message: '工作流更新成功',
      data: workflow
    });
  } catch (error) {
    console.error('更新工作流错误:', error);
    res.status(500).json({
      status: 'error',
      message: '更新工作流过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 删除工作流
 */
exports.deleteWorkflow = async (req, res) => {
  try {
    const workflowId = req.params.id;
    const userId = req.userId;

    // 查询工作流
    const workflow = await Workflow.findByPk(workflowId);
    if (!workflow) {
      return res.status(404).json({
        status: 'error',
        message: '工作流不存在'
      });
    }

    // 检查权限
    if (workflow.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权删除此工作流'
      });
    }

    // 检查是否处于可删除状态
    if (workflow.status !== 'draft' && workflow.status !== 'rejected' && req.user.role !== 'admin') {
      return res.status(400).json({
        status: 'error',
        message: '当前状态无法删除工作流'
      });
    }

    // 删除工作流
    await workflow.destroy();

    res.status(200).json({
      status: 'success',
      message: '工作流删除成功'
    });
  } catch (error) {
    console.error('删除工作流错误:', error);
    res.status(500).json({
      status: 'error',
      message: '删除工作流过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 提交工作流进入审批流程
 */
exports.submitWorkflow = async (req, res) => {
  try {
    const workflowId = req.params.id;
    const { comment } = req.body;
    const userId = req.userId;

    // 查询工作流
    const workflow = await Workflow.findByPk(workflowId);
    if (!workflow) {
      return res.status(404).json({
        status: 'error',
        message: '工作流不存在'
      });
    }

    // 检查权限
    if (workflow.createdBy !== userId) {
      return res.status(403).json({
        status: 'error',
        message: '无权提交此工作流'
      });
    }

    // 检查是否处于可提交状态
    if (workflow.status !== 'draft' && workflow.status !== 'rejected') {
      return res.status(400).json({
        status: 'error',
        message: '当前状态无法提交工作流'
      });
    }

    // 获取审批人
    // 这里简化处理，实际应根据流程类型和组织架构确定审批人
    const approver = await getNextApprover(workflow.type, userId);

    // 更新工作流状态
    await workflow.update({
      status: 'pending',
      currentHandler: approver,
      currentStep: 1
    });

    // 记录工作流历史
    await WorkflowHistory.create({
      workflowId,
      action: 'submit',
      userId,
      comment: comment || '提交审批'
    });

    res.status(200).json({
      status: 'success',
      message: '工作流提交成功',
      data: workflow
    });
  } catch (error) {
    console.error('提交工作流错误:', error);
    res.status(500).json({
      status: 'error',
      message: '提交工作流过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 批准工作流
 */
exports.approveWorkflow = async (req, res) => {
  try {
    const workflowId = req.params.id;
    const { comment } = req.body;
    const userId = req.userId;

    // 查询工作流
    const workflow = await Workflow.findByPk(workflowId);
    if (!workflow) {
      return res.status(404).json({
        status: 'error',
        message: '工作流不存在'
      });
    }

    // 检查权限
    if (workflow.currentHandler !== userId) {
      return res.status(403).json({
        status: 'error',
        message: '您不是当前处理人，无权审批此工作流'
      });
    }

    // 检查是否处于待审批状态
    if (workflow.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: '当前工作流状态不是待审批'
      });
    }

    // 判断是否为最后一步审批
    const isLastStep = await isLastApprovalStep(workflow.type, workflow.currentStep);
    
    if (isLastStep) {
      // 完成审批流程
      await workflow.update({
        status: 'approved',
        currentHandler: null,
        completedAt: new Date()
      });
    } else {
      // 获取下一步审批人
      const nextApprover = await getNextApprover(workflow.type, workflow.currentHandler, workflow.currentStep + 1);
      
      // 更新工作流状态
      await workflow.update({
        currentHandler: nextApprover,
        currentStep: workflow.currentStep + 1
      });
    }

    // 记录工作流历史
    await WorkflowHistory.create({
      workflowId,
      action: 'approve',
      userId,
      comment: comment || '批准工作流'
    });

    res.status(200).json({
      status: 'success',
      message: isLastStep ? '工作流已最终批准' : '工作流已批准并进入下一步',
      data: workflow
    });
  } catch (error) {
    console.error('审批工作流错误:', error);
    res.status(500).json({
      status: 'error',
      message: '审批工作流过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 拒绝工作流
 */
exports.rejectWorkflow = async (req, res) => {
  try {
    const workflowId = req.params.id;
    const { comment } = req.body;
    const userId = req.userId;

    // 查询工作流
    const workflow = await Workflow.findByPk(workflowId);
    if (!workflow) {
      return res.status(404).json({
        status: 'error',
        message: '工作流不存在'
      });
    }

    // 检查权限
    if (workflow.currentHandler !== userId) {
      return res.status(403).json({
        status: 'error',
        message: '您不是当前处理人，无权拒绝此工作流'
      });
    }

    // 检查是否处于待审批状态
    if (workflow.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: '当前工作流状态不是待审批'
      });
    }

    // 更新工作流状态 (退回给创建者)
    await workflow.update({
      status: 'rejected',
      currentHandler: workflow.createdBy,
      currentStep: 0
    });

    // 记录工作流历史
    await WorkflowHistory.create({
      workflowId,
      action: 'reject',
      userId,
      comment: comment || '拒绝工作流'
    });

    res.status(200).json({
      status: 'success',
      message: '工作流已拒绝',
      data: workflow
    });
  } catch (error) {
    console.error('拒绝工作流错误:', error);
    res.status(500).json({
      status: 'error',
      message: '拒绝工作流过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 辅助函数：获取下一步审批人
async function getNextApprover(workflowType, currentUserId, step = 1) {
  // 实际场景中，应根据组织结构和流程定义获取审批人
  // 这里简化处理，仅做示例
  try {
    // 查询当前用户的部门经理或相关审批人
    const user = await User.findByPk(currentUserId);
    
    if (!user) {
      throw new Error('用户不存在');
    }
    
    let nextApprover;
    
    // 根据流程类型和当前步骤获取下一个审批人
    if (workflowType === 'leave' || workflowType === 'expense') {
      // 请假和报销流程
      if (step === 1) {
        // 第一步：直接上级审批
        nextApprover = await User.findOne({
          where: {
            department: user.department,
            role: 'manager'
          }
        });
      } else if (step === 2) {
        // 第二步：部门经理以上的审批
        nextApprover = await User.findOne({
          where: {
            role: 'admin'
          }
        });
      }
    } else {
      // 其他类型流程，简化为单步审批
      nextApprover = await User.findOne({
        where: {
          role: 'admin'
        }
      });
    }
    
    if (!nextApprover) {
      // 如果找不到合适的审批人，默认指定一个系统管理员
      nextApprover = await User.findOne({
        where: {
          role: 'admin'
        }
      });
    }
    
    return nextApprover ? nextApprover.id : null;
  } catch (error) {
    console.error('获取审批人错误:', error);
    throw error;
  }
}

// 辅助函数：判断是否为最后一步审批
async function isLastApprovalStep(workflowType, currentStep) {
  // 根据流程类型判断当前是否为最后一步
  if (workflowType === 'leave' || workflowType === 'expense') {
    // 请假和报销流程有两步审批
    return currentStep >= 2;
  } else {
    // 其他类型流程只有一步审批
    return currentStep >= 1;
  }
} 