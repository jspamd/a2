const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { verifyToken, checkRole } = require('../middleware/auth');

// 获取所有考勤记录
router.get('/', verifyToken, attendanceController.getAllAttendances);

// 获取个人考勤记录
router.get('/my', verifyToken, attendanceController.getMyAttendance);

// 获取单个考勤记录
router.get('/:id', verifyToken, attendanceController.getAttendance);

// 签到
router.post('/check-in', verifyToken, attendanceController.checkIn);

// 签退
router.post('/check-out', verifyToken, attendanceController.checkOut);

// 申请请假
router.post('/leave', verifyToken, attendanceController.applyLeave);

// 处理请假申请(管理员)
router.put('/leave/:id', verifyToken, checkRole(['admin']), attendanceController.processLeave);

module.exports = router; 