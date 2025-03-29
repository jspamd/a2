const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { verifyToken, checkRole } = require('../middleware/auth');

// 所有公告路由都需要认证
router.use(verifyToken);

// 获取公告列表 - 所有用户可访问
router.get('/', announcementController.getAnnouncements);

// 获取公告详情 - 所有用户可访问
router.get('/:id', announcementController.getAnnouncementById);

// 标记公告已读 - 所有用户可访问
router.post('/:id/read', announcementController.markAnnouncementAsRead);

// 创建公告 - 仅限管理员、部门经理
router.post('/', checkRole(['admin', 'manager']), announcementController.createAnnouncement);

// 更新公告 - 仅限管理员、部门经理、公告创建者
router.put('/:id', checkRole(['admin', 'manager']), announcementController.updateAnnouncement);

// 删除公告 - 仅限管理员
router.delete('/:id', checkRole(['admin']), announcementController.deleteAnnouncement);

module.exports = router; 