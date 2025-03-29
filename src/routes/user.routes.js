const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken, checkRole } = require('../middleware/auth');
const { userValidators, validate } = require('../middleware/validator');

// 所有用户路由都需要认证
router.use(verifyToken);

// 获取所有用户 - 仅限管理员
router.get('/', checkRole(['admin']), userController.getAllUsers);

// 获取用户详情 - 用户可访问自己的信息，管理员可访问所有用户信息
router.get('/:id', userController.getUserById);

// 创建用户 - 仅限管理员
router.post('/', 
  checkRole(['admin']), 
  userValidators.create, 
  validate, 
  userController.createUser
);

// 更新用户 - 用户可更新自己的信息，管理员可更新所有用户信息
router.put('/:id', 
  userValidators.update, 
  validate, 
  userController.updateUser
);

// 删除用户 - 仅限管理员
router.delete('/:id', checkRole(['admin']), userController.deleteUser);

// 获取用户角色 - 仅限管理员和用户本人
router.get('/:id/roles', userController.getUserRoles);

// 更新用户角色 - 仅限管理员
router.put('/:id/roles', 
  checkRole(['admin']), 
  userController.updateUserRoles
);

// 重置用户密码 - 仅限管理员
router.post('/:id/reset-password', 
  checkRole(['admin']), 
  userValidators.resetPassword, 
  validate, 
  userController.resetPassword
);

module.exports = router; 