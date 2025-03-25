const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 获取所有工作流
router.get('/', authMiddleware.verifyToken, workflowController.getAllWorkflows);

// 获取单个工作流
router.get('/:id', authMiddleware.verifyToken, workflowController.getWorkflow);

// 创建工作流
router.post('/', authMiddleware.verifyToken, workflowController.createWorkflow);

// 更新工作流
router.put('/:id', authMiddleware.verifyToken, workflowController.updateWorkflow);

// 删除工作流
router.delete('/:id', authMiddleware.verifyToken, workflowController.deleteWorkflow);

// 提交审批
router.post('/:id/submit', authMiddleware.verifyToken, workflowController.submitWorkflow);

// 审批操作
router.post('/:id/approve', authMiddleware.verifyToken, workflowController.approveWorkflow);

// 拒绝操作
router.post('/:id/reject', authMiddleware.verifyToken, workflowController.rejectWorkflow);

module.exports = router; 