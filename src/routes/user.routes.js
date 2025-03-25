const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');

// 路由处理函数
// 注意：这里暂时用简单的处理函数代替，实际应用中应该引入用户控制器
const userController = {
  getAllUsers: (req, res) => {
    res.status(200).json({
      status: 'success',
      message: '获取所有用户成功',
      data: [
        { id: 1, username: 'admin', name: '系统管理员', email: 'admin@example.com', role: 'admin' },
        { id: 2, username: 'manager1', name: '王五', email: 'manager1@example.com', role: 'manager' },
        { id: 3, username: 'user1', name: '张三', email: 'user1@example.com', role: 'employee' }
      ]
    });
  },
  
  getUserById: (req, res) => {
    const userId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '获取用户成功',
      data: { id: userId, username: 'admin', name: '系统管理员', email: 'admin@example.com', role: 'admin' }
    });
  },
  
  createUser: (req, res) => {
    res.status(201).json({
      status: 'success',
      message: '用户创建成功',
      data: { id: 4, ...req.body }
    });
  },
  
  updateUser: (req, res) => {
    const userId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '用户更新成功',
      data: { id: userId, ...req.body }
    });
  },
  
  deleteUser: (req, res) => {
    const userId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '用户删除成功',
      data: { id: userId }
    });
  },
  
  getUserRoles: (req, res) => {
    const userId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '获取用户角色成功',
      data: [
        { id: 1, name: '系统管理员', code: 'admin' }
      ]
    });
  },
  
  updateUserRoles: (req, res) => {
    const userId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '用户角色更新成功',
      data: { userId, roles: req.body.roles }
    });
  },
  
  resetPassword: (req, res) => {
    const userId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '密码重置成功',
      data: { userId }
    });
  }
};

// 获取所有用户 (仅管理员和部门经理)
router.get('/', verifyToken, checkRole(['admin', 'manager']), userController.getAllUsers);

// 根据ID获取单个用户
router.get('/:id', verifyToken, userController.getUserById);

// 创建新用户 (仅管理员和部门经理)
router.post('/', verifyToken, checkRole(['admin', 'manager']), userController.createUser);

// 更新用户 (仅管理员和部门经理，或用户自己)
router.put('/:id', verifyToken, userController.updateUser);

// 删除用户 (仅管理员)
router.delete('/:id', verifyToken, checkRole(['admin']), userController.deleteUser);

// 获取用户角色
router.get('/:id/roles', verifyToken, userController.getUserRoles);

// 更新用户角色 (仅管理员)
router.put('/:id/roles', verifyToken, checkRole(['admin']), userController.updateUserRoles);

// 重置用户密码 (仅管理员)
router.post('/:id/reset-password', verifyToken, checkRole(['admin']), userController.resetPassword);

module.exports = router; 