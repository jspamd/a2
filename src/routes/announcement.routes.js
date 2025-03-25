const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 获取所有公告
router.get('/', authMiddleware.verifyToken, announcementController.getAllAnnouncements);

// 获取单个公告
router.get('/:id', authMiddleware.verifyToken, announcementController.getAnnouncement);

// 创建公告(管理员)
router.post('/', authMiddleware.verifyToken, authMiddleware.isAdmin, announcementController.createAnnouncement);

// 更新公告(管理员)
router.put('/:id', authMiddleware.verifyToken, authMiddleware.isAdmin, announcementController.updateAnnouncement);

// 删除公告(管理员)
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.isAdmin, announcementController.deleteAnnouncement);

// 标记公告为已读
router.post('/:id/read', authMiddleware.verifyToken, announcementController.markAsRead);

module.exports = router; 