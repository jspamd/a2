const {
  AttendanceRule,
  DepartmentAttendanceRule,
  AttendanceRecord,
  LeaveRecord,
  OvertimeRecord,
  User,
  Department
} = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

/**
 * 获取考勤规则
 */
exports.getAttendanceRules = async (req, res, next) => {
  try {
    // 获取全局考勤规则
    const globalRules = await AttendanceRule.findAll({
      order: [['updatedAt', 'DESC']]
    });
    
    // 获取部门特殊规则
    const departmentRules = await DepartmentAttendanceRule.findAll({
      include: [{ model: Department }],
      order: [['departmentId', 'ASC']]
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取考勤规则成功',
      data: {
        globalRules,
        departmentRules
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新全局考勤规则
 */
exports.updateAttendanceRule = async (req, res, next) => {
  try {
    const {
      workDays,
      workStartTime,
      workEndTime,
      lunchBreakStart,
      lunchBreakEnd,
      checkinStartBuffer,
      checkinEndBuffer,
      checkoutStartBuffer,
      checkoutEndBuffer,
      lateThreshold,
      earlyLeaveThreshold,
      absentThreshold
    } = req.body;
    
    // 查找现有规则
    let rule = await AttendanceRule.findOne();
    
    if (!rule) {
      // 创建新规则
      rule = await AttendanceRule.create({
        workDays: workDays || '1,2,3,4,5', // 默认周一至周五
        workStartTime: workStartTime || '09:00',
        workEndTime: workEndTime || '18:00',
        lunchBreakStart: lunchBreakStart || '12:00',
        lunchBreakEnd: lunchBreakEnd || '13:00',
        checkinStartBuffer: checkinStartBuffer !== undefined ? checkinStartBuffer : 30, // 默认提前30分钟可打卡
        checkinEndBuffer: checkinEndBuffer !== undefined ? checkinEndBuffer : 30, // 默认延后30分钟可打卡
        checkoutStartBuffer: checkoutStartBuffer !== undefined ? checkoutStartBuffer : 30, // 默认提前30分钟可打卡
        checkoutEndBuffer: checkoutEndBuffer !== undefined ? checkoutEndBuffer : 60, // 默认延后60分钟可打卡
        lateThreshold: lateThreshold !== undefined ? lateThreshold : 15, // 默认迟到15分钟以上记录
        earlyLeaveThreshold: earlyLeaveThreshold !== undefined ? earlyLeaveThreshold : 15, // 默认早退15分钟以上记录
        absentThreshold: absentThreshold !== undefined ? absentThreshold : 120 // 默认迟到120分钟以上按旷工处理
      });
    } else {
      // 更新现有规则
      await rule.update({
        workDays: workDays || rule.workDays,
        workStartTime: workStartTime || rule.workStartTime,
        workEndTime: workEndTime || rule.workEndTime,
        lunchBreakStart: lunchBreakStart || rule.lunchBreakStart,
        lunchBreakEnd: lunchBreakEnd || rule.lunchBreakEnd,
        checkinStartBuffer: checkinStartBuffer !== undefined ? checkinStartBuffer : rule.checkinStartBuffer,
        checkinEndBuffer: checkinEndBuffer !== undefined ? checkinEndBuffer : rule.checkinEndBuffer,
        checkoutStartBuffer: checkoutStartBuffer !== undefined ? checkoutStartBuffer : rule.checkoutStartBuffer,
        checkoutEndBuffer: checkoutEndBuffer !== undefined ? checkoutEndBuffer : rule.checkoutEndBuffer,
        lateThreshold: lateThreshold !== undefined ? lateThreshold : rule.lateThreshold,
        earlyLeaveThreshold: earlyLeaveThreshold !== undefined ? earlyLeaveThreshold : rule.earlyLeaveThreshold,
        absentThreshold: absentThreshold !== undefined ? absentThreshold : rule.absentThreshold
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: '考勤规则更新成功',
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 设置部门特殊考勤规则
 */
exports.setDepartmentAttendanceRule = async (req, res, next) => {
  try {
    const departmentId = req.params.departmentId;
    const {
      workDays,
      workStartTime,
      workEndTime,
      lunchBreakStart,
      lunchBreakEnd,
      checkinStartBuffer,
      checkinEndBuffer,
      checkoutStartBuffer,
      checkoutEndBuffer
    } = req.body;
    
    // 检查部门是否存在
    const department = await Department.findByPk(departmentId);
    
    if (!department) {
      return next(new AppError('部门不存在', 404));
    }
    
    // 查找现有规则
    let rule = await DepartmentAttendanceRule.findOne({
      where: { departmentId }
    });
    
    if (!rule) {
      // 创建新规则
      rule = await DepartmentAttendanceRule.create({
        departmentId,
        workDays,
        workStartTime,
        workEndTime,
        lunchBreakStart,
        lunchBreakEnd,
        checkinStartBuffer,
        checkinEndBuffer,
        checkoutStartBuffer,
        checkoutEndBuffer
      });
    } else {
      // 更新现有规则
      await rule.update({
        workDays: workDays !== undefined ? workDays : rule.workDays,
        workStartTime: workStartTime !== undefined ? workStartTime : rule.workStartTime,
        workEndTime: workEndTime !== undefined ? workEndTime : rule.workEndTime,
        lunchBreakStart: lunchBreakStart !== undefined ? lunchBreakStart : rule.lunchBreakStart,
        lunchBreakEnd: lunchBreakEnd !== undefined ? lunchBreakEnd : rule.lunchBreakEnd,
        checkinStartBuffer: checkinStartBuffer !== undefined ? checkinStartBuffer : rule.checkinStartBuffer,
        checkinEndBuffer: checkinEndBuffer !== undefined ? checkinEndBuffer : rule.checkinEndBuffer,
        checkoutStartBuffer: checkoutStartBuffer !== undefined ? checkoutStartBuffer : rule.checkoutStartBuffer,
        checkoutEndBuffer: checkoutEndBuffer !== undefined ? checkoutEndBuffer : rule.checkoutEndBuffer
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: '部门考勤规则设置成功',
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除部门特殊考勤规则
 */
exports.deleteDepartmentAttendanceRule = async (req, res, next) => {
  try {
    const departmentId = req.params.departmentId;
    
    // 查找现有规则
    const rule = await DepartmentAttendanceRule.findOne({
      where: { departmentId }
    });
    
    if (!rule) {
      return next(new AppError('部门考勤规则不存在', 404));
    }
    
    // 删除规则
    await rule.destroy();
    
    res.status(200).json({
      status: 'success',
      message: '部门考勤规则已删除'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户的考勤规则 (整合全局规则和部门特殊规则)
 */
exports.getUserAttendanceRule = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // 查找用户信息
    const user = await User.findByPk(userId, {
      include: [{ model: Department, as: 'department' }]
    });
    
    if (!user) {
      return next(new AppError('用户不存在', 404));
    }
    
    // 获取全局规则
    const globalRule = await AttendanceRule.findOne();
    
    if (!globalRule) {
      return next(new AppError('全局考勤规则未设置', 404));
    }
    
    // 获取部门规则（如果存在）
    let departmentRule = null;
    if (user.departmentId) {
      departmentRule = await DepartmentAttendanceRule.findOne({
        where: { departmentId: user.departmentId }
      });
    }
    
    // 整合规则
    const rule = {
      ...globalRule.toJSON(),
      ...(departmentRule ? departmentRule.toJSON() : {}),
      department: user.department ? user.department.name : null
    };
    
    // 删除不需要的字段
    if (departmentRule) {
      delete rule.id;
      delete rule.createdAt;
      delete rule.updatedAt;
      delete rule.departmentId;
    }
    
    res.status(200).json({
      status: 'success',
      message: '获取用户考勤规则成功',
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 打卡（签到/签退）
 */
exports.clockIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, latitude, longitude, location, remark, device } = req.body;
    
    // 验证打卡类型
    if (type !== 'checkin' && type !== 'checkout') {
      return next(new AppError('打卡类型无效，必须是checkin或checkout', 400));
    }
    
    // 获取当前日期
    const today = moment().format('YYYY-MM-DD');
    const now = moment();
    
    // 查找用户
    const user = await User.findByPk(userId, {
      include: [{ model: Department, as: 'department' }]
    });
    
    if (!user) {
      return next(new AppError('用户不存在', 404));
    }
    
    // 获取适用的考勤规则
    const globalRule = await AttendanceRule.findOne();
    
    if (!globalRule) {
      return next(new AppError('全局考勤规则未设置', 404));
    }
    
    // 获取部门规则（如果存在）
    let departmentRule = null;
    if (user.departmentId) {
      departmentRule = await DepartmentAttendanceRule.findOne({
        where: { departmentId: user.departmentId }
      });
    }
    
    // 整合规则
    const rule = {
      ...globalRule.toJSON(),
      ...(departmentRule ? departmentRule.toJSON() : {})
    };
    
    // 检查今天是否是工作日
    const workDays = rule.workDays.split(',').map(day => parseInt(day.trim()));
    const today_day = now.day(); // 0是周日，1-6是周一到周六
    const is_workday = workDays.includes(today_day === 0 ? 7 : today_day); // 转换周日为7便于比较
    
    if (!is_workday) {
      return next(new AppError('今天不是工作日', 400));
    }
    
    // 检查是否已有打卡记录
    const existingRecord = await AttendanceRecord.findOne({
      where: {
        userId,
        recordDate: today
      }
    });
    
    // 处理签到
    if (type === 'checkin') {
      if (existingRecord && existingRecord.checkinTime) {
        return next(new AppError('今天已经签到', 400));
      }
      
      // 计算签到状态
      const workStartMoment = moment(today + ' ' + rule.workStartTime);
      const lateMinutes = now.diff(workStartMoment, 'minutes');
      
      let status = 'normal';
      if (lateMinutes > rule.lateThreshold) {
        status = 'late';
      }
      if (lateMinutes > rule.absentThreshold) {
        status = 'absent';
      }
      
      // 创建或更新打卡记录
      if (existingRecord) {
        await existingRecord.update({
          checkinTime: now.format('HH:mm:ss'),
          checkinLatitude: latitude,
          checkinLongitude: longitude,
          checkinLocation: location,
          checkinRemark: remark,
          checkinDevice: device,
          checkinStatus: status
        });
      } else {
        await AttendanceRecord.create({
          userId,
          recordDate: today,
          checkinTime: now.format('HH:mm:ss'),
          checkinLatitude: latitude,
          checkinLongitude: longitude,
          checkinLocation: location,
          checkinRemark: remark,
          checkinDevice: device,
          checkinStatus: status
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: '签到成功',
        data: {
          time: now.format('YYYY-MM-DD HH:mm:ss'),
          status
        }
      });
    } 
    // 处理签退
    else if (type === 'checkout') {
      if (!existingRecord || !existingRecord.checkinTime) {
        return next(new AppError('今天尚未签到', 400));
      }
      
      if (existingRecord.checkoutTime) {
        return next(new AppError('今天已经签退', 400));
      }
      
      // 计算签退状态
      const workEndMoment = moment(today + ' ' + rule.workEndTime);
      const earlyMinutes = workEndMoment.diff(now, 'minutes');
      
      let status = 'normal';
      if (earlyMinutes > rule.earlyLeaveThreshold) {
        status = 'early_leave';
      }
      
      // 更新打卡记录
      await existingRecord.update({
        checkoutTime: now.format('HH:mm:ss'),
        checkoutLatitude: latitude,
        checkoutLongitude: longitude,
        checkoutLocation: location,
        checkoutRemark: remark,
        checkoutDevice: device,
        checkoutStatus: status,
        workHours: calculateWorkHours(
          existingRecord.checkinTime, 
          now.format('HH:mm:ss'),
          rule.workStartTime,
          rule.workEndTime,
          rule.lunchBreakStart,
          rule.lunchBreakEnd
        )
      });
      
      res.status(200).json({
        status: 'success',
        message: '签退成功',
        data: {
          time: now.format('YYYY-MM-DD HH:mm:ss'),
          status
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 获取个人考勤记录
 */
exports.getPersonalAttendanceRecords = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 日期范围参数
    const startDate = req.query.startDate || moment().startOf('month').format('YYYY-MM-DD');
    const endDate = req.query.endDate || moment().endOf('month').format('YYYY-MM-DD');
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 31; // 默认一个月
    const offset = (page - 1) * limit;
    
    // 执行查询
    const { count, rows } = await AttendanceRecord.findAndCountAll({
      where: {
        userId,
        recordDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['recordDate', 'DESC']],
      limit,
      offset
    });
    
    // 获取请假记录
    const leaveRecords = await LeaveRecord.findAll({
      where: {
        userId,
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
        ],
        status: 'approved'
      }
    });
    
    // 获取加班记录
    const overtimeRecords = await OvertimeRecord.findAll({
      where: {
        userId,
        [Op.or]: [
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
        ],
        status: 'approved'
      }
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    // 计算统计信息
    const stats = {
      total: count,
      normal: rows.filter(r => r.checkinStatus === 'normal' && r.checkoutStatus === 'normal').length,
      late: rows.filter(r => r.checkinStatus === 'late').length,
      earlyLeave: rows.filter(r => r.checkoutStatus === 'early_leave').length,
      absent: rows.filter(r => r.checkinStatus === 'absent').length,
      leaveCount: leaveRecords.length,
      overtimeCount: overtimeRecords.length
    };
    
    res.status(200).json({
      status: 'success',
      message: '获取个人考勤记录成功',
      data: {
        records: rows,
        leaveRecords,
        overtimeRecords,
        stats
      },
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
 * 获取部门考勤记录（管理员和部门经理可查看）
 */
exports.getDepartmentAttendanceRecords = async (req, res, next) => {
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
      return next(new AppError('您没有权限查看部门考勤记录', 403));
    }
    
    // 日期范围参数
    const startDate = req.query.startDate || moment().startOf('month').format('YYYY-MM-DD');
    const endDate = req.query.endDate || moment().endOf('month').format('YYYY-MM-DD');
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 获取部门用户
    const users = await User.findAll({
      where: { departmentId },
      attributes: ['id', 'username', 'name']
    });
    
    const userIds = users.map(user => user.id);
    
    if (userIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: '部门没有成员',
        data: {
          records: [],
          stats: {
            total: 0,
            normal: 0,
            late: 0,
            earlyLeave: 0,
            absent: 0
          }
        },
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      });
    }
    
    // 执行查询
    const { count, rows } = await AttendanceRecord.findAndCountAll({
      where: {
        userId: {
          [Op.in]: userIds
        },
        recordDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        { model: User, attributes: ['id', 'username', 'name'] }
      ],
      order: [['recordDate', 'DESC']],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    // 计算统计信息
    const stats = {
      total: count,
      normal: rows.filter(r => r.checkinStatus === 'normal' && r.checkoutStatus === 'normal').length,
      late: rows.filter(r => r.checkinStatus === 'late').length,
      earlyLeave: rows.filter(r => r.checkoutStatus === 'early_leave').length,
      absent: rows.filter(r => r.checkinStatus === 'absent').length
    };
    
    res.status(200).json({
      status: 'success',
      message: '获取部门考勤记录成功',
      data: {
        records: rows,
        stats
      },
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

// 辅助函数：计算工作时长
function calculateWorkHours(checkinTime, checkoutTime, workStartTime, workEndTime, lunchBreakStart, lunchBreakEnd) {
  try {
    // 将时间转换为分钟
    const toMinutes = time => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const checkinMinutes = toMinutes(checkinTime);
    const checkoutMinutes = toMinutes(checkoutTime);
    const workStartMinutes = toMinutes(workStartTime);
    const workEndMinutes = toMinutes(workEndTime);
    const lunchStartMinutes = toMinutes(lunchBreakStart);
    const lunchEndMinutes = toMinutes(lunchBreakEnd);
    
    // 计算有效的签到时间（不早于工作开始时间）
    const effectiveCheckinMinutes = Math.max(checkinMinutes, workStartMinutes);
    
    // 计算有效的签退时间（不晚于工作结束时间）
    const effectiveCheckoutMinutes = Math.min(checkoutMinutes, workEndMinutes);
    
    // 计算午休时间
    let lunchBreakMinutes = 0;
    
    // 如果有效工作时间跨越了午休时间
    if (effectiveCheckinMinutes < lunchEndMinutes && effectiveCheckoutMinutes > lunchStartMinutes) {
      const lunchOverlapStart = Math.max(effectiveCheckinMinutes, lunchStartMinutes);
      const lunchOverlapEnd = Math.min(effectiveCheckoutMinutes, lunchEndMinutes);
      lunchBreakMinutes = Math.max(0, lunchOverlapEnd - lunchOverlapStart);
    }
    
    // 计算总工作分钟数
    let totalWorkMinutes = Math.max(0, effectiveCheckoutMinutes - effectiveCheckinMinutes - lunchBreakMinutes);
    
    // 转换为小时，保留一位小数
    return Math.round(totalWorkMinutes / 6) / 10;
  } catch (error) {
    console.error('计算工作时长出错:', error);
    return 0;
  }
} 