const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');
const { logger } = require('../utils/logger');

// 获取数据库模型
let models;
const getModels = async () => {
  if (!models) {
    models = await require('../models')();
  }
  return models;
};

/**
 * 申请加班
 */
exports.applyOvertime = async (req, res, next) => {
  try {
    const models = await getModels();
    const { OvertimeRecord, User, Department, Role } = models;
    
    const userId = req.user.id;
    const {
      overtimeType,
      startDateTime,
      endDateTime,
      reason,
      location,
      attachment
    } = req.body;
    
    // 验证必填字段
    if (!overtimeType || !startDateTime || !endDateTime || !reason) {
      return next(new AppError('加班类型、开始时间、结束时间和加班原因为必填项', 400));
    }
    
    // 检查加班类型
    const validOvertimeTypes = ['workday', 'weekend', 'holiday'];
    if (!validOvertimeTypes.includes(overtimeType)) {
      return next(new AppError('无效的加班类型', 400));
    }
    
    // 检查时间范围
    const start = moment(startDateTime);
    const end = moment(endDateTime);
    
    if (!start.isValid() || !end.isValid()) {
      return next(new AppError('无效的时间格式', 400));
    }
    
    if (end.isBefore(start)) {
      return next(new AppError('结束时间不能早于开始时间', 400));
    }
    
    // 计算加班时长（小时）
    const duration = end.diff(start, 'hours', true);
    
    if (duration < 0.5) {
      return next(new AppError('加班时长不能少于30分钟', 400));
    }
    
    // 查找用户
    const user = await User.findByPk(userId, {
      include: [{ model: Department, as: 'department' }]
    });
    
    if (!user) {
      return next(new AppError('用户不存在', 404));
    }
    
    // 检查是否有重叠的加班记录
    const overlappingOvertime = await OvertimeRecord.findOne({
      where: {
        userId,
        status: {
          [Op.notIn]: ['rejected', 'cancelled']
        },
        [Op.or]: [
          {
            startDateTime: {
              [Op.between]: [startDateTime, endDateTime]
            }
          },
          {
            endDateTime: {
              [Op.between]: [startDateTime, endDateTime]
            }
          },
          {
            [Op.and]: [
              { startDateTime: { [Op.lte]: startDateTime } },
              { endDateTime: { [Op.gte]: endDateTime } }
            ]
          }
        ]
      }
    });
    
    if (overlappingOvertime) {
      return next(new AppError('您在该时间段内已有加班记录', 400));
    }
    
    // 确定审批人 (部门主管)
    let approverId = null;
    if (user.department && user.department.managerId) {
      approverId = user.department.managerId;
      
      // 如果申请人就是部门主管，设置更高级别的审批人
      if (approverId === userId) {
        // 查找上级部门的主管或管理员角色的用户
        if (user.department.parentId) {
          const parentDept = await Department.findByPk(user.department.parentId);
          if (parentDept && parentDept.managerId) {
            approverId = parentDept.managerId;
          }
        } else {
          // 如果没有更高级别的部门，查找管理员
          const admin = await User.findOne({
            include: [{
              model: Role,
              where: { code: 'admin' }
            }],
            where: {
              id: { [Op.ne]: userId }
            }
          });
          
          if (admin) {
            approverId = admin.id;
          }
        }
      }
    }
    
    // 创建加班记录
    const overtimeRecord = await OvertimeRecord.create({
      userId,
      overtimeType,
      startDateTime,
      endDateTime,
      duration,
      reason,
      location: location || null,
      attachment: attachment || null,
      approverId,
      status: 'pending'
    });
    
    res.status(201).json({
      status: 'success',
      message: '加班申请提交成功',
      data: overtimeRecord
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取个人加班记录
 */
exports.getPersonalOvertimeRecords = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 日期范围参数
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const status = req.query.status;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    const whereCondition = { userId };
    
    if (startDate && endDate) {
      whereCondition[Op.or] = [
        {
          startDateTime: {
            [Op.between]: [
              moment(startDate).startOf('day').toDate(),
              moment(endDate).endOf('day').toDate()
            ]
          }
        },
        {
          endDateTime: {
            [Op.between]: [
              moment(startDate).startOf('day').toDate(),
              moment(endDate).endOf('day').toDate()
            ]
          }
        }
      ];
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    // 执行查询
    const { count, rows } = await OvertimeRecord.findAndCountAll({
      where: whereCondition,
      include: [
        { model: User, as: 'approver', attributes: ['id', 'username', 'name'] }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取个人加班记录成功',
      data: rows,
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
 * 获取待审批的加班记录
 */
exports.getPendingOvertimeRecords = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 执行查询
    const { count, rows } = await OvertimeRecord.findAndCountAll({
      where: {
        approverId: userId,
        status: 'pending'
      },
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'username', 'name'],
          include: [{ model: Department, as: 'department' }]
        }
      ],
      order: [['createdAt', 'ASC']],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取待审批加班记录成功',
      data: rows,
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
 * 获取部门加班记录
 */
exports.getDepartmentOvertimeRecords = async (req, res, next) => {
  try {
    const departmentId = req.params.departmentId;
    
    // 检查权限
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    // 检查是否是部门经理
    const isDepartmentManager = await Department.count({
      where: {
        id: departmentId,
        managerId: userId
      }
    }) > 0;
    
    if (!isAdmin && !isDepartmentManager) {
      return next(new AppError('您没有权限查看部门加班记录', 403));
    }
    
    // 日期范围参数
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const status = req.query.status;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 获取部门用户
    const users = await User.findAll({
      where: { departmentId },
      attributes: ['id']
    });
    
    const userIds = users.map(user => user.id);
    
    if (userIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: '部门没有成员',
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      });
    }
    
    // 构建查询条件
    const whereCondition = {
      userId: {
        [Op.in]: userIds
      }
    };
    
    if (startDate && endDate) {
      whereCondition[Op.or] = [
        {
          startDateTime: {
            [Op.between]: [
              moment(startDate).startOf('day').toDate(),
              moment(endDate).endOf('day').toDate()
            ]
          }
        },
        {
          endDateTime: {
            [Op.between]: [
              moment(startDate).startOf('day').toDate(),
              moment(endDate).endOf('day').toDate()
            ]
          }
        }
      ];
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    // 执行查询
    const { count, rows } = await OvertimeRecord.findAndCountAll({
      where: whereCondition,
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'username', 'name']
        },
        { 
          model: User, 
          as: 'approver', 
          attributes: ['id', 'username', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取部门加班记录成功',
      data: rows,
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
 * 审批加班
 */
exports.approveOvertime = async (req, res, next) => {
  try {
    const overtimeId = req.params.id;
    const { action, comment } = req.body;
    
    // 验证操作
    if (action !== 'approve' && action !== 'reject') {
      return next(new AppError('无效的操作，只能是approve或reject', 400));
    }
    
    // 查找加班记录
    const overtimeRecord = await OvertimeRecord.findByPk(overtimeId, {
      include: [
        { model: User, as: 'user' }
      ]
    });
    
    if (!overtimeRecord) {
      return next(new AppError('加班记录不存在', 404));
    }
    
    // 检查状态
    if (overtimeRecord.status !== 'pending') {
      return next(new AppError(`该加班申请已${overtimeRecord.status === 'approved' ? '审批通过' : overtimeRecord.status === 'rejected' ? '拒绝' : '取消'}，无法再次操作`, 400));
    }
    
    // 检查权限
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && overtimeRecord.approverId !== userId) {
      return next(new AppError('您不是该申请的审批人，无权操作', 403));
    }
    
    // 更新加班记录
    await overtimeRecord.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      approvalComment: comment || null,
      approvalTime: new Date()
    });
    
    res.status(200).json({
      status: 'success',
      message: `加班申请已${action === 'approve' ? '通过' : '拒绝'}`,
      data: await OvertimeRecord.findByPk(overtimeId, {
        include: [
          { model: User, as: 'user' },
          { model: User, as: 'approver' }
        ]
      })
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 取消加班
 */
exports.cancelOvertime = async (req, res, next) => {
  try {
    const overtimeId = req.params.id;
    
    // 查找加班记录
    const overtimeRecord = await OvertimeRecord.findByPk(overtimeId);
    
    if (!overtimeRecord) {
      return next(new AppError('加班记录不存在', 404));
    }
    
    // 检查状态
    if (overtimeRecord.status !== 'pending' && overtimeRecord.status !== 'approved') {
      return next(new AppError(`该加班申请已${overtimeRecord.status === 'rejected' ? '拒绝' : '取消'}，无法操作`, 400));
    }
    
    // 检查权限
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && overtimeRecord.userId !== userId) {
      return next(new AppError('您只能取消自己的加班申请', 403));
    }
    
    // 已审批通过且即将开始的加班不能取消
    if (overtimeRecord.status === 'approved') {
      const now = moment();
      const startDateTime = moment(overtimeRecord.startDateTime);
      
      if (startDateTime.isBefore(now)) {
        return next(new AppError('已开始的加班不能取消', 400));
      }
    }
    
    // 更新加班记录
    await overtimeRecord.update({
      status: 'cancelled',
      cancelTime: new Date()
    });
    
    res.status(200).json({
      status: 'success',
      message: '加班申请已取消',
      data: overtimeRecord
    });
  } catch (error) {
    next(error);
  }
}; 