const { Attendance, LeaveRequest } = require('../models');
const { Sequelize, Op } = require('sequelize');

/**
 * 获取所有考勤记录 (管理员功能)
 */
exports.getAllAttendances = async (req, res) => {
  try {
    // 检查权限
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: '权限不足，无法访问所有考勤记录'
      });
    }

    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 筛选参数
    const { userId, date, startDate, endDate, department } = req.query;

    // 构建查询条件
    const whereCondition = {};
    
    if (userId) {
      whereCondition.userId = userId;
    }
    
    if (date) {
      whereCondition.date = date;
    } else if (startDate && endDate) {
      whereCondition.date = {
        [Op.between]: [startDate, endDate]
      };
    }

    // 部门筛选需要联表查询用户表
    const includeCondition = [];
    if (department) {
      includeCondition.push({
        model: User,
        attributes: [],
        where: { department }
      });
    }

    // 查询考勤记录
    const { count, rows } = await Attendance.findAndCountAll({
      where: whereCondition,
      include: includeCondition,
      limit,
      offset,
      order: [['date', 'DESC'], ['checkInTime', 'DESC']]
    });

    // 计算总页数
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: 'success',
      data: {
        attendances: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取考勤记录错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取考勤记录过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取个人考勤记录
 */
exports.getMyAttendance = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 日期范围参数
    const { startDate, endDate } = req.query;
    
    // 构建查询条件
    const whereCondition = { userId };
    
    if (startDate && endDate) {
      whereCondition.date = {
        [Op.between]: [startDate, endDate]
      };
    }

    // 查询考勤记录
    const { count, rows } = await Attendance.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [['date', 'DESC']]
    });

    // 计算总页数
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: 'success',
      data: {
        attendances: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取个人考勤记录错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取个人考勤记录过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取单个考勤记录
 */
exports.getAttendance = async (req, res) => {
  try {
    const attendanceId = req.params.id;
    const userId = req.userId;

    // 查询考勤记录
    const attendance = await Attendance.findByPk(attendanceId);

    if (!attendance) {
      return res.status(404).json({
        status: 'error',
        message: '考勤记录不存在'
      });
    }

    // 检查权限
    if (attendance.userId !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: '无权查看此考勤记录'
      });
    }

    res.status(200).json({
      status: 'success',
      data: attendance
    });
  } catch (error) {
    console.error('获取考勤记录错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取考勤记录信息过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 签到
 */
exports.checkIn = async (req, res) => {
  try {
    const userId = req.userId;
    const { location, remark } = req.body;
    
    // 当前日期
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // 检查今天是否已经签到
    const existingAttendance = await Attendance.findOne({
      where: {
        userId,
        date: dateStr
      }
    });

    if (existingAttendance && existingAttendance.checkInTime) {
      return res.status(400).json({
        status: 'error',
        message: '今天已经签到过了'
      });
    }

    // 当前时间
    const now = new Date();
    const checkInTime = now.toTimeString().split(' ')[0];

    // 判断是否迟到
    const workStartTime = process.env.WORK_START_TIME || '09:00:00';
    const isLate = checkInTime > workStartTime;

    // 创建或更新考勤记录
    let attendance;
    if (existingAttendance) {
      // 更新现有记录
      attendance = await existingAttendance.update({
        checkInTime,
        checkInLocation: location,
        isLate,
        remark
      });
    } else {
      // 创建新记录
      attendance = await Attendance.create({
        userId,
        date: dateStr,
        checkInTime,
        checkInLocation: location,
        isLate,
        remark
      });
    }

    res.status(200).json({
      status: 'success',
      message: '签到成功',
      data: attendance
    });
  } catch (error) {
    console.error('签到错误:', error);
    res.status(500).json({
      status: 'error',
      message: '签到过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 签退
 */
exports.checkOut = async (req, res) => {
  try {
    const userId = req.userId;
    const { location, remark } = req.body;
    
    // 当前日期
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // 查找今天的考勤记录
    const attendance = await Attendance.findOne({
      where: {
        userId,
        date: dateStr
      }
    });

    if (!attendance) {
      return res.status(400).json({
        status: 'error',
        message: '今天还没有签到记录，请先签到'
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        status: 'error',
        message: '今天已经签退过了'
      });
    }

    // 当前时间
    const now = new Date();
    const checkOutTime = now.toTimeString().split(' ')[0];

    // 判断是否早退
    const workEndTime = process.env.WORK_END_TIME || '18:00:00';
    const isEarlyLeave = checkOutTime < workEndTime;

    // 更新考勤记录
    await attendance.update({
      checkOutTime,
      checkOutLocation: location,
      isEarlyLeave,
      remark: attendance.remark ? `${attendance.remark}; ${remark || ''}` : remark
    });

    res.status(200).json({
      status: 'success',
      message: '签退成功',
      data: attendance
    });
  } catch (error) {
    console.error('签退错误:', error);
    res.status(500).json({
      status: 'error',
      message: '签退过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 申请请假
 */
exports.applyLeave = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate, type, reason } = req.body;
    
    // 验证请假日期
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return res.status(400).json({
        status: 'error',
        message: '开始日期不能晚于结束日期'
      });
    }
    
    if (start < new Date()) {
      return res.status(400).json({
        status: 'error',
        message: '不能申请过去的日期'
      });
    }
    
    // 计算请假天数
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    // 创建请假申请
    const leaveRequest = await LeaveRequest.create({
      userId,
      startDate,
      endDate,
      days,
      type,
      reason,
      status: 'pending'
    });
    
    // 启动请假审批流程
    // TODO: 集成工作流系统

    res.status(201).json({
      status: 'success',
      message: '请假申请提交成功',
      data: leaveRequest
    });
  } catch (error) {
    console.error('请假申请错误:', error);
    res.status(500).json({
      status: 'error',
      message: '请假申请过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 处理请假申请 (管理员或经理)
 */
exports.processLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { status, comment } = req.body;
    const userId = req.userId;
    
    // 检查权限
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: '权限不足，无法处理请假申请'
      });
    }
    
    // 查找请假申请
    const leaveRequest = await LeaveRequest.findByPk(leaveId);
    
    if (!leaveRequest) {
      return res.status(404).json({
        status: 'error',
        message: '请假申请不存在'
      });
    }
    
    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: '此请假申请已经处理过了'
      });
    }
    
    // 更新请假申请状态
    await leaveRequest.update({
      status,
      processedBy: userId,
      processedAt: new Date(),
      comment
    });
    
    res.status(200).json({
      status: 'success',
      message: '请假申请处理成功',
      data: leaveRequest
    });
  } catch (error) {
    console.error('处理请假申请错误:', error);
    res.status(500).json({
      status: 'error',
      message: '处理请假申请过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 