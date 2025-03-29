const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const { verifyToken, checkRole } = require('../middleware/auth');

// 所有工作流路由都需要认证
router.use(verifyToken);

// 工作流定义相关路由
// 获取工作流定义列表 - 所有用户可访问
router.get('/', workflowController.getAllWorkflowDefinitions);

// 获取工作流定义详情 - 所有用户可访问
router.get('/:id', workflowController.getWorkflowDefinitionById);

// 创建工作流定义 - 仅限管理员和经理
router.post('/', checkRole(['admin', 'manager']), workflowController.createWorkflowDefinition);

// 更新工作流定义 - 仅限管理员、经理和创建者
router.put('/:id', checkRole(['admin', 'manager']), workflowController.updateWorkflowDefinition);

// 删除工作流定义 - 仅限管理员
router.delete('/:id', checkRole(['admin']), workflowController.deleteWorkflowDefinition);

// 工作流实例相关路由
// 启动工作流实例 - 所有用户可访问
router.post('/:id/instances', workflowController.createWorkflowInstance);

// 获取工作流实例列表 - 所有用户可访问
router.get('/instances', workflowController.getMyWorkflowInstances);

// 获取工作流实例详情 - 所有用户可访问（权限检查在控制器中）
router.get('/instances/:id', workflowController.getWorkflowInstanceById);

// 取消工作流实例 - 所有用户可访问（权限检查在控制器中）
router.post('/instances/:id/cancel', workflowController.cancelWorkflowInstance);

// 工作流任务相关路由
// 获取我的待办任务列表 - 所有用户可访问
router.get('/tasks/my', workflowController.getMyPendingApprovals);

// 处理任务 - 所有用户可访问（权限检查在控制器中）
router.post('/tasks/:id/process', workflowController.processTask);

module.exports = router; 