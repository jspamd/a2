const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 获取所有考勤记录
router.get('/', authMiddleware.verifyToken, attendanceController.getAllAttendances);

// 获取个人考勤记录
router.get('/my', authMiddleware.verifyToken, attendanceController.getMyAttendance);

// 获取单个考勤记录
router.get('/:id', authMiddleware.verifyToken, attendanceController.getAttendance);

// 签到
router.post('/check-in', authMiddleware.verifyToken, attendanceController.checkIn);

// 签退
router.post('/check-out', authMiddleware.verifyToken, attendanceController.checkOut);

// 申请请假
router.post('/leave', authMiddleware.verifyToken, attendanceController.applyLeave);

// 处理请假申请(管理员)
router.put('/leave/:id', authMiddleware.verifyToken, authMiddleware.isAdmin, attendanceController.processLeave);

module.exports = router; 