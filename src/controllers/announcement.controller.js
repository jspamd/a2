const { Announcement, AnnouncementRead } = require('../models');
const { Sequelize, Op } = require('sequelize');

/**
 * 获取所有公告
 */
exports.getAllAnnouncements = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 筛选参数
    const { type, search } = req.query;

    // 构建查询条件
    const whereCondition = {};
    
    if (type) {
      whereCondition.type = type;
    }
    
    if (search) {
      whereCondition[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } }
      ];
    }

    // 查询公告列表
    const { count, rows } = await Announcement.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
      include: [
        {
          model: AnnouncementRead,
          as: 'readRecords',
          required: false,
          where: { userId },
          attributes: ['id', 'readAt']
        }
      ]
    });

    // 计算总页数
    const totalPages = Math.ceil(count / limit);

    // 处理已读状态
    const announcementsWithReadStatus = rows.map(announcement => {
      const plainAnnouncement = announcement.get({ plain: true });
      plainAnnouncement.isRead = plainAnnouncement.readRecords && plainAnnouncement.readRecords.length > 0;
      delete plainAnnouncement.readRecords;
      return plainAnnouncement;
    });

    res.status(200).json({
      status: 'success',
      data: {
        announcements: announcementsWithReadStatus,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取公告列表错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取公告列表过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取单个公告
 */
exports.getAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id;
    const userId = req.userId;

    // 查询公告
    const announcement = await Announcement.findByPk(announcementId, {
      include: [
        {
          model: AnnouncementRead,
          as: 'readRecords',
          required: false,
          where: { userId },
          attributes: ['id', 'readAt']
        }
      ]
    });

    if (!announcement) {
      return res.status(404).json({
        status: 'error',
        message: '公告不存在'
      });
    }

    // 处理已读状态
    const plainAnnouncement = announcement.get({ plain: true });
    plainAnnouncement.isRead = plainAnnouncement.readRecords && plainAnnouncement.readRecords.length > 0;
    delete plainAnnouncement.readRecords;

    // 自动标记为已读
    if (!plainAnnouncement.isRead) {
      await AnnouncementRead.create({
        announcementId,
        userId,
        readAt: new Date()
      });
      plainAnnouncement.isRead = true;
    }

    res.status(200).json({
      status: 'success',
      data: plainAnnouncement
    });
  } catch (error) {
    console.error('获取公告错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取公告信息过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 创建公告
 */
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, type, department, isPinned, attachments } = req.body;
    const userId = req.userId;

    // 检查权限
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: '权限不足，无法创建公告'
      });
    }

    // 创建公告
    const announcement = await Announcement.create({
      title,
      content,
      type,
      department,
      isPinned: !!isPinned,
      attachments,
      createdBy: userId
    });

    res.status(201).json({
      status: 'success',
      message: '公告创建成功',
      data: announcement
    });
  } catch (error) {
    console.error('创建公告错误:', error);
    res.status(500).json({
      status: 'error',
      message: '创建公告过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 更新公告
 */
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id;
    const { title, content, type, department, isPinned, attachments } = req.body;
    const userId = req.userId;

    // 检查权限
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: '权限不足，无法更新公告'
      });
    }

    // 查询公告
    const announcement = await Announcement.findByPk(announcementId);
    if (!announcement) {
      return res.status(404).json({
        status: 'error',
        message: '公告不存在'
      });
    }

    // 更新公告
    await announcement.update({
      title,
      content,
      type,
      department,
      isPinned: isPinned !== undefined ? !!isPinned : announcement.isPinned,
      attachments,
      updatedBy: userId
    });

    res.status(200).json({
      status: 'success',
      message: '公告更新成功',
      data: announcement
    });
  } catch (error) {
    console.error('更新公告错误:', error);
    res.status(500).json({
      status: 'error',
      message: '更新公告过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 删除公告
 */
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id;

    // 检查权限
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: '权限不足，无法删除公告'
      });
    }

    // 查询公告
    const announcement = await Announcement.findByPk(announcementId);
    if (!announcement) {
      return res.status(404).json({
        status: 'error',
        message: '公告不存在'
      });
    }

    // 删除公告
    await announcement.destroy();

    res.status(200).json({
      status: 'success',
      message: '公告删除成功'
    });
  } catch (error) {
    console.error('删除公告错误:', error);
    res.status(500).json({
      status: 'error',
      message: '删除公告过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 标记公告为已读
 */
exports.markAsRead = async (req, res) => {
  try {
    const announcementId = req.params.id;
    const userId = req.userId;

    // 查询公告
    const announcement = await Announcement.findByPk(announcementId);
    if (!announcement) {
      return res.status(404).json({
        status: 'error',
        message: '公告不存在'
      });
    }

    // 检查是否已经标记为已读
    const existingRecord = await AnnouncementRead.findOne({
      where: {
        announcementId,
        userId
      }
    });

    if (existingRecord) {
      return res.status(200).json({
        status: 'success',
        message: '公告已经标记为已读'
      });
    }

    // 创建已读记录
    await AnnouncementRead.create({
      announcementId,
      userId,
      readAt: new Date()
    });

    res.status(200).json({
      status: 'success',
      message: '公告已标记为已读'
    });
  } catch (error) {
    console.error('标记公告已读错误:', error);
    res.status(500).json({
      status: 'error',
      message: '标记公告已读过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 