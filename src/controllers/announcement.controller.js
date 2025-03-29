const {
  Announcement,
  AnnouncementTarget,
  AnnouncementRead,
  User,
  Department,
  Role
} = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

/**
 * 发布公告
 */
exports.createAnnouncement = async (req, res, next) => {
  try {
    const publisherId = req.user.id;
    const {
      title,
      content,
      type,
      importance,
      attachments,
      publishTo,
      expireDate
    } = req.body;
    
    // 验证必填字段
    if (!title || !content || !type || !importance || !publishTo) {
      return next(new AppError('标题、内容、类型、重要性和发布对象为必填项', 400));
    }
    
    // 验证公告类型
    const validTypes = ['notice', 'news', 'activity', 'policy', 'other'];
    if (!validTypes.includes(type)) {
      return next(new AppError('无效的公告类型', 400));
    }
    
    // 验证重要性
    const validImportance = ['high', 'medium', 'low'];
    if (!validImportance.includes(importance)) {
      return next(new AppError('无效的重要性级别', 400));
    }
    
    // 验证发布对象
    if (!Array.isArray(publishTo) || publishTo.length === 0) {
      return next(new AppError('发布对象必须是一个非空数组', 400));
    }
    
    // 发布对象验证
    for (const target of publishTo) {
      if (!target.type || !['all', 'department', 'role', 'user'].includes(target.type)) {
        return next(new AppError('发布对象类型无效', 400));
      }
      
      if (target.type !== 'all' && !target.id) {
        return next(new AppError(`发布对象类型为${target.type}时，必须指定ID`, 400));
      }
    }
    
    // 创建公告
    const announcement = await Announcement.create({
      title,
      content,
      type,
      importance,
      attachments: attachments || null,
      publisherId,
      publishTime: new Date(),
      expireDate: expireDate ? new Date(expireDate) : null,
      status: 'published'
    });
    
    // 创建公告发布对象记录
    const targetRecords = [];
    for (const target of publishTo) {
      targetRecords.push({
        announcementId: announcement.id,
        targetType: target.type,
        targetId: target.type === 'all' ? null : target.id
      });
    }
    
    await AnnouncementTarget.bulkCreate(targetRecords);
    
    // 返回创建的公告，包括发布对象
    const result = await Announcement.findByPk(announcement.id, {
      include: [
        { model: User, as: 'publisher', attributes: ['id', 'username', 'name'] },
        { model: AnnouncementTarget, as: 'targets' }
      ]
    });
    
    res.status(201).json({
      status: 'success',
      message: '公告发布成功',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取公告列表
 */
exports.getAnnouncements = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userDepartmentId = req.user.departmentId;
    
    // 查询参数
    const type = req.query.type;
    const importance = req.query.importance;
    const status = req.query.status;
    const onlyUnread = req.query.onlyUnread === 'true';
    const search = req.query.search || '';
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 获取用户角色ID
    const userRoleIds = await Role.findAll({
      attributes: ['id'],
      include: [{
        model: User,
        where: { id: userId }
      }]
    }).map(role => role.id);
    
    // 构建公告查询条件
    const announcementWhere = {};
    
    if (type) {
      announcementWhere.type = type;
    }
    
    if (importance) {
      announcementWhere.importance = importance;
    }
    
    if (status) {
      announcementWhere.status = status;
    } else {
      // 默认只查询已发布的公告
      announcementWhere.status = 'published';
    }
    
    if (search) {
      announcementWhere[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // 构建发布对象查询条件
    const targetWhere = {
      [Op.or]: [
        { targetType: 'all' },
        { targetType: 'user', targetId: userId },
        { targetType: 'department', targetId: userDepartmentId }
      ]
    };
    
    // 添加角色条件
    if (userRoleIds.length > 0) {
      targetWhere[Op.or].push({
        targetType: 'role',
        targetId: {
          [Op.in]: userRoleIds
        }
      });
    }
    
    // 获取公告
    const { count, rows } = await Announcement.findAndCountAll({
      where: announcementWhere,
      include: [
        { 
          model: User, 
          as: 'publisher', 
          attributes: ['id', 'username', 'name'] 
        },
        {
          model: AnnouncementTarget,
          as: 'targets',
          where: targetWhere,
          required: true
        }
      ],
      distinct: true,
      order: [
        ['importance', 'DESC'],
        ['publishTime', 'DESC']
      ],
      limit,
      offset
    });
    
    // 获取已读状态
    const announcementIds = rows.map(announcement => announcement.id);
    const readRecords = await AnnouncementRead.findAll({
      where: {
        userId,
        announcementId: {
          [Op.in]: announcementIds
        }
      }
    });
    
    const readAnnouncementIds = new Set(readRecords.map(record => record.announcementId));
    
    // 如果只查询未读公告，过滤掉已读公告
    let filteredRows = rows;
    if (onlyUnread) {
      filteredRows = rows.filter(announcement => !readAnnouncementIds.has(announcement.id));
    }
    
    // 添加已读状态到公告数据
    const announcementsWithReadStatus = filteredRows.map(announcement => {
      const isRead = readAnnouncementIds.has(announcement.id);
      return {
        ...announcement.toJSON(),
        isRead
      };
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    // 获取未读公告数量
    const unreadCount = await Announcement.count({
      where: {
        status: 'published',
        id: {
          [Op.notIn]: Array.from(readAnnouncementIds)
        }
      },
      include: [
        {
          model: AnnouncementTarget,
          as: 'targets',
          where: targetWhere,
          required: true
        }
      ],
      distinct: true
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取公告列表成功',
      data: announcementsWithReadStatus,
      unreadCount,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取公告详情
 */
exports.getAnnouncementById = async (req, res, next) => {
  try {
    const announcementId = req.params.id;
    const userId = req.user.id;
    const userDepartmentId = req.user.departmentId;
    
    // 获取用户角色ID
    const userRoleIds = await Role.findAll({
      attributes: ['id'],
      include: [{
        model: User,
        where: { id: userId }
      }]
    }).map(role => role.id);
    
    // 获取公告
    const announcement = await Announcement.findByPk(announcementId, {
      include: [
        { 
          model: User, 
          as: 'publisher', 
          attributes: ['id', 'username', 'name'] 
        },
        {
          model: AnnouncementTarget,
          as: 'targets'
        }
      ]
    });
    
    if (!announcement) {
      return next(new AppError('公告不存在', 404));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isPublisher = announcement.publisherId === userId;
    
    if (!isAdmin && !isPublisher) {
      // 检查是否是该公告的目标用户
      const targets = announcement.targets;
      const hasAccess = targets.some(target => {
        if (target.targetType === 'all') return true;
        if (target.targetType === 'user' && target.targetId === userId) return true;
        if (target.targetType === 'department' && target.targetId === userDepartmentId) return true;
        if (target.targetType === 'role' && userRoleIds.includes(target.targetId)) return true;
        return false;
      });
      
      if (!hasAccess) {
        return next(new AppError('您没有权限查看此公告', 403));
      }
    }
    
    // 查询公告阅读记录
    let readRecord = await AnnouncementRead.findOne({
      where: {
        announcementId,
        userId
      }
    });
    
    // 如果没有阅读记录，创建一个
    if (!readRecord) {
      readRecord = await AnnouncementRead.create({
        announcementId,
        userId,
        readTime: new Date()
      });
    }
    
    // 获取读者统计
    const readCount = await AnnouncementRead.count({
      where: { announcementId }
    });
    
    // 获取目标用户数量
    const targets = announcement.targets;
    let targetCount = 0;
    
    for (const target of targets) {
      if (target.targetType === 'all') {
        // 所有用户
        targetCount = await User.count({ where: { status: 'active' } });
        break;
      } else if (target.targetType === 'department') {
        // 部门用户
        targetCount += await User.count({
          where: {
            departmentId: target.targetId,
            status: 'active'
          }
        });
      } else if (target.targetType === 'role') {
        // 角色用户
        const roleUsers = await User.count({
          include: [{
            model: Role,
            where: { id: target.targetId }
          }],
          where: { status: 'active' }
        });
        targetCount += roleUsers;
      } else if (target.targetType === 'user') {
        // 单个用户
        targetCount += 1;
      }
    }
    
    // 添加阅读统计
    const announcementWithStats = {
      ...announcement.toJSON(),
      readCount,
      targetCount,
      readRate: targetCount > 0 ? Math.round((readCount / targetCount) * 100) : 0
    };
    
    res.status(200).json({
      status: 'success',
      message: '获取公告详情成功',
      data: announcementWithStats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 标记公告为已读
 */
exports.markAnnouncementAsRead = async (req, res, next) => {
  try {
    const announcementId = req.params.id;
    const userId = req.user.id;
    
    // 检查公告是否存在
    const announcement = await Announcement.findByPk(announcementId);
    
    if (!announcement) {
      return next(new AppError('公告不存在', 404));
    }
    
    // 查找或创建阅读记录
    const [readRecord, created] = await AnnouncementRead.findOrCreate({
      where: {
        announcementId,
        userId
      },
      defaults: {
        readTime: new Date()
      }
    });
    
    res.status(200).json({
      status: 'success',
      message: created ? '公告已标记为已读' : '公告已经是已读状态',
      data: readRecord
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新公告
 */
exports.updateAnnouncement = async (req, res, next) => {
  try {
    const announcementId = req.params.id;
    const userId = req.user.id;
    const {
      title,
      content,
      type,
      importance,
      attachments,
      publishTo,
      expireDate,
      status
    } = req.body;
    
    // 查找公告
    const announcement = await Announcement.findByPk(announcementId);
    
    if (!announcement) {
      return next(new AppError('公告不存在', 404));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && announcement.publisherId !== userId) {
      return next(new AppError('您没有权限更新此公告', 403));
    }
    
    // 验证状态
    if (status && !['draft', 'published', 'archived'].includes(status)) {
      return next(new AppError('无效的公告状态', 400));
    }
    
    // 验证类型
    if (type && !['notice', 'news', 'activity', 'policy', 'other'].includes(type)) {
      return next(new AppError('无效的公告类型', 400));
    }
    
    // 验证重要性
    if (importance && !['high', 'medium', 'low'].includes(importance)) {
      return next(new AppError('无效的重要性级别', 400));
    }
    
    // 更新公告
    await announcement.update({
      title: title || announcement.title,
      content: content || announcement.content,
      type: type || announcement.type,
      importance: importance || announcement.importance,
      attachments: attachments !== undefined ? attachments : announcement.attachments,
      expireDate: expireDate ? new Date(expireDate) : announcement.expireDate,
      status: status || announcement.status,
      updatedAt: new Date()
    });
    
    // 如果更新了发布对象
    if (publishTo && Array.isArray(publishTo) && publishTo.length > 0) {
      // 删除旧的发布对象
      await AnnouncementTarget.destroy({
        where: { announcementId }
      });
      
      // 创建新的发布对象
      const targetRecords = publishTo.map(target => ({
        announcementId,
        targetType: target.type,
        targetId: target.type === 'all' ? null : target.id
      }));
      
      await AnnouncementTarget.bulkCreate(targetRecords);
    }
    
    // 获取更新后的公告
    const updatedAnnouncement = await Announcement.findByPk(announcementId, {
      include: [
        { model: User, as: 'publisher', attributes: ['id', 'username', 'name'] },
        { model: AnnouncementTarget, as: 'targets' }
      ]
    });
    
    res.status(200).json({
      status: 'success',
      message: '公告更新成功',
      data: updatedAnnouncement
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除公告
 */
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const announcementId = req.params.id;
    const userId = req.user.id;
    
    // 查找公告
    const announcement = await Announcement.findByPk(announcementId);
    
    if (!announcement) {
      return next(new AppError('公告不存在', 404));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && announcement.publisherId !== userId) {
      return next(new AppError('您没有权限删除此公告', 403));
    }
    
    // 删除公告的发布对象
    await AnnouncementTarget.destroy({
      where: { announcementId }
    });
    
    // 删除公告的阅读记录
    await AnnouncementRead.destroy({
      where: { announcementId }
    });
    
    // 删除公告
    await announcement.destroy();
    
    res.status(200).json({
      status: 'success',
      message: '公告删除成功'
    });
  } catch (error) {
    next(error);
  }
}; 