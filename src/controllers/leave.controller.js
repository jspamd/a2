const {
  LeaveRecord,
  User,
  Department
} = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

/**
 * 申请请假
 */
exports.applyLeave = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      leaveType,
      startDate,
      endDate,
      startTime,
      endTime,
      reason,
      contactInfo,
      attachment
    } = req.body;
    
    // 验证必填字段
    if (!leaveType || !startDate || !endDate || !reason) {
      return next(new AppError('请假类型、开始日期、结束日期和请假原因为必填项', 400));
    }
    
    // 检查请假类型
    const validLeaveTypes = ['annual', 'sick', 'personal', 'marriage', 'maternity', 'paternity', 'bereavement', 'other'];
    if (!validLeaveTypes.includes(leaveType)) {
      return next(new AppError('无效的请假类型', 400));
    }
    
    // 检查日期范围
    const start = moment(startDate);
    const end = moment(endDate);
    
    if (!start.isValid() || !end.isValid()) {
      return next(new AppError('无效的日期格式', 400));
    }
    
    if (end.isBefore(start)) {
      return next(new AppError('结束日期不能早于开始日期', 400));
    }
    
    // 查找用户
    const user = await User.findByPk(userId, {
      include: [{ model: Department, as: 'department' }]
    });
    
    if (!user) {
      return next(new AppError('用户不存在', 404));
    }
    
    // 检查是否有重叠的请假记录
    const overlappingLeave = await LeaveRecord.findOne({
      where: {
        userId,
        status: {
          [Op.notIn]: ['rejected', 'cancelled']
        },
        [Op.or]: [
          {
            startDate: {
              [Op.between]: [startDate, endDate]
            }
          },
          {
            endDate: {
              [Op.between]: [startDate, endDate]
            }
          },
          {
            [Op.and]: [
              { startDate: { [Op.lte]: startDate } },
              { endDate: { [Op.gte]: endDate } }
            ]
          }
        ]
      }
    });
    
    if (overlappingLeave) {
      return next(new AppError('您在该时间段内已有请假记录', 400));
    }
    
    // 计算请假天数
    const days = end.diff(start, 'days') + 1;
    
    // 如果指定了具体时间，计算小时数
    let hours = null;
    if (startTime && endTime) {
      const startTimeMoment = moment(startTime, 'HH:mm');
      const endTimeMoment = moment(endTime, 'HH:mm');
      
      if (!startTimeMoment.isValid() || !endTimeMoment.isValid()) {
        return next(new AppError('无效的时间格式', 400));
      }
      
      if (endTimeMoment.isBefore(startTimeMoment)) {
        return next(new AppError('结束时间不能早于开始时间', 400));
      }
      
      hours = endTimeMoment.diff(startTimeMoment, 'hours', true);
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
    
    // 创建请假记录
    const leaveRecord = await LeaveRecord.create({
      userId,
      leaveType,
      startDate,
      endDate,
      startTime: startTime || null,
      endTime: endTime || null,
      days,
      hours,
      reason,
      contactInfo: contactInfo || null,
      attachment: attachment || null,
      approverId,
      status: 'pending'
    });
    
    res.status(201).json({
      status: 'success',
      message: '请假申请提交成功',
      data: leaveRecord
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取个人请假记录
 */
exports.getPersonalLeaveRecords = async (req, res, next) => {
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
          startDate: {
            [Op.between]: [startDate, endDate]
          }
        },
        {
          endDate: {
            [Op.between]: [startDate, endDate]
          }
        },
        {
          [Op.and]: [
            { startDate: { [Op.lte]: startDate } },
            { endDate: { [Op.gte]: endDate } }
          ]
        }
      ];
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    // 执行查询
    const { count, rows } = await LeaveRecord.findAndCountAll({
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
      message: '获取个人请假记录成功',
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
 * 获取待审批的请假记录
 */
exports.getPendingLeaveRecords = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 执行查询
    const { count, rows } = await LeaveRecord.findAndCountAll({
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
      message: '获取待审批请假记录成功',
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
 * 获取部门请假记录
 */
exports.getDepartmentLeaveRecords = async (req, res, next) => {
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
      return next(new AppError('您没有权限查看部门请假记录', 403));
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
          startDate: {
            [Op.between]: [startDate, endDate]
          }
        },
        {
          endDate: {
            [Op.between]: [startDate, endDate]
          }
        },
        {
          [Op.and]: [
            { startDate: { [Op.lte]: startDate } },
            { endDate: { [Op.gte]: endDate } }
          ]
        }
      ];
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    // 执行查询
    const { count, rows } = await LeaveRecord.findAndCountAll({
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
      message: '获取部门请假记录成功',
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
 * 审批请假
 */
exports.approveLeave = async (req, res, next) => {
  try {
    const leaveId = req.params.id;
    const { action, comment } = req.body;
    
    // 验证操作
    if (action !== 'approve' && action !== 'reject') {
      return next(new AppError('无效的操作，只能是approve或reject', 400));
    }
    
    // 查找请假记录
    const leaveRecord = await LeaveRecord.findByPk(leaveId, {
      include: [
        { model: User, as: 'user' }
      ]
    });
    
    if (!leaveRecord) {
      return next(new AppError('请假记录不存在', 404));
    }
    
    // 检查状态
    if (leaveRecord.status !== 'pending') {
      return next(new AppError(`该请假申请已${leaveRecord.status === 'approved' ? '审批通过' : leaveRecord.status === 'rejected' ? '拒绝' : '取消'}，无法再次操作`, 400));
    }
    
    // 检查权限
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && leaveRecord.approverId !== userId) {
      return next(new AppError('您不是该申请的审批人，无权操作', 403));
    }
    
    // 更新请假记录
    await leaveRecord.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      approvalComment: comment || null,
      approvalTime: new Date()
    });
    
    res.status(200).json({
      status: 'success',
      message: `请假申请已${action === 'approve' ? '通过' : '拒绝'}`,
      data: await LeaveRecord.findByPk(leaveId, {
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
 * 取消请假
 */
exports.cancelLeave = async (req, res, next) => {
  try {
    const leaveId = req.params.id;
    
    // 查找请假记录
    const leaveRecord = await LeaveRecord.findByPk(leaveId);
    
    if (!leaveRecord) {
      return next(new AppError('请假记录不存在', 404));
    }
    
    // 检查状态
    if (leaveRecord.status !== 'pending' && leaveRecord.status !== 'approved') {
      return next(new AppError(`该请假申请已${leaveRecord.status === 'rejected' ? '拒绝' : '取消'}，无法操作`, 400));
    }
    
    // 检查权限
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && leaveRecord.userId !== userId) {
      return next(new AppError('您只能取消自己的请假申请', 403));
    }
    
    // 已审批通过且即将开始的请假不能取消
    if (leaveRecord.status === 'approved') {
      const today = moment().startOf('day');
      const startDate = moment(leaveRecord.startDate);
      
      if (startDate.isBefore(today)) {
        return next(new AppError('已开始的请假不能取消', 400));
      }
    }
    
    // 更新请假记录
    await leaveRecord.update({
      status: 'cancelled',
      cancelTime: new Date()
    });
    
    res.status(200).json({
      status: 'success',
      message: '请假申请已取消',
      data: leaveRecord
    });
  } catch (error) {
    next(error);
  }
}; 