const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { verifyToken, checkRole } = require('../middleware/auth');

// 所有日程路由都需要认证
router.use(verifyToken);

// 获取日程列表 - 所有用户可访问
router.get('/', scheduleController.getSchedules);

// 获取日程详情 - 所有用户可访问
router.get('/:id', scheduleController.getScheduleById);

// 创建日程 - 所有用户可访问
router.post('/', scheduleController.createSchedule);

// 更新日程参与状态 - 所有用户可访问
router.post('/:id/status', scheduleController.updateParticipantStatus);

// 更新日程 - 需要是创建者或管理员
router.put('/:id', scheduleController.updateSchedule);

// 删除日程 - 需要是创建者或管理员
router.delete('/:id', scheduleController.deleteSchedule);

module.exports = router; 