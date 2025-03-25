const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 获取所有日程
router.get('/', authMiddleware.verifyToken, scheduleController.getAllSchedules);

// 获取个人日程
router.get('/my', authMiddleware.verifyToken, scheduleController.getMySchedules);

// 获取单个日程
router.get('/:id', authMiddleware.verifyToken, scheduleController.getSchedule);

// 创建日程
router.post('/', authMiddleware.verifyToken, scheduleController.createSchedule);

// 更新日程
router.put('/:id', authMiddleware.verifyToken, scheduleController.updateSchedule);

// 删除日程
router.delete('/:id', authMiddleware.verifyToken, scheduleController.deleteSchedule);

// 添加日程参与者
router.post('/:id/participants', authMiddleware.verifyToken, scheduleController.addParticipants);

// 设置提醒
router.post('/:id/reminder', authMiddleware.verifyToken, scheduleController.setReminder);

module.exports = router; 