const express = require('express');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @description 用户注册
 * @access Public
 */
router.post('/register', authController.register);

/**
 * @route POST /api/auth/login
 * @description 用户登录
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route GET /api/auth/me
 * @description 获取当前登录用户信息
 * @access Private
 */
router.get('/me', verifyToken, authController.getCurrentUser);

/**
 * @route POST /api/auth/change-password
 * @description 修改密码
 * @access Private
 */
router.post('/change-password', verifyToken, authController.changePassword);

/**
 * @route POST /api/auth/refresh-token
 * @description 刷新令牌
 * @access Private
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @route POST /api/auth/logout
 * @description 用户登出
 * @access Private
 */
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
