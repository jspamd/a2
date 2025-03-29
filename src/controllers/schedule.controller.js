const { 
  Schedule, 
  ScheduleParticipant, 
  User, 
  Department 
} = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

/**
 * 获取所有日程
 */
exports.getAllSchedules = async (req, res) => {
  try {
    // 检查权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '权限不足，无法查看所有日程'
      });
    }

    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 筛选参数
    const { startDate, endDate, type } = req.query;
    
    // 构建查询条件
    const whereCondition = {};
    
    if (startDate && endDate) {
      whereCondition[Op.or] = [
        // 开始日期在查询范围内
        { startTime: { [Op.between]: [startDate, endDate] } },
        // 结束日期在查询范围内
        { endTime: { [Op.between]: [startDate, endDate] } },
        // 跨越整个查询范围
        {
          [Op.and]: [
            { startTime: { [Op.lte]: startDate } },
            { endTime: { [Op.gte]: endDate } }
          ]
        }
      ];
    }
    
    if (type) {
      whereCondition.type = type;
    }

    // 查询日程列表
    const { count, rows } = await Schedule.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [['startTime', 'ASC']],
      include: [
        {
          model: ScheduleParticipant,
          as: 'participants',
          include: [
            {
              model: User,
              attributes: ['id', 'username', 'fullName', 'email']
            }
          ]
        }
      ]
    });

    // 计算总页数
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: 'success',
      data: {
        schedules: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取日程列表错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取日程列表过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取个人日程
 */
exports.getMySchedules = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 分页和时间范围参数
    const { startDate, endDate } = req.query;
    
    // 验证日期参数
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: '请提供开始和结束日期'
      });
    }
    
    // 查询条件：作为创建者或参与者的日程
    const schedules = await Schedule.findAll({
      where: {
        [Op.or]: [
          // 开始日期在查询范围内
          { startTime: { [Op.between]: [startDate, endDate] } },
          // 结束日期在查询范围内
          { endTime: { [Op.between]: [startDate, endDate] } },
          // 跨越整个查询范围
          {
            [Op.and]: [
              { startTime: { [Op.lte]: startDate } },
              { endTime: { [Op.gte]: endDate } }
            ]
          }
        ],
        [Op.or]: [
          // 用户创建的日程
          { createdBy: userId },
          // 用户参与的日程
          { '$participants.userId$': userId }
        ]
      },
      include: [
        {
          model: ScheduleParticipant,
          as: 'participants',
          include: [
            {
              model: User,
              attributes: ['id', 'username', 'fullName', 'email']
            }
          ]
        }
      ],
      order: [['startTime', 'ASC']]
    });

    res.status(200).json({
      status: 'success',
      data: schedules
    });
  } catch (error) {
    console.error('获取个人日程错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取个人日程过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取单个日程
 */
exports.getSchedule = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const userId = req.userId;

    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId, {
      include: [
        {
          model: ScheduleParticipant,
          as: 'participants',
          include: [
            {
              model: User,
              attributes: ['id', 'username', 'fullName', 'email']
            }
          ]
        }
      ]
    });

    if (!schedule) {
      return res.status(404).json({
        status: 'error',
        message: '日程不存在'
      });
    }

    // 检查权限：创建者、参与者或管理员可以查看
    const isParticipant = schedule.participants.some(p => p.userId === userId);
    if (schedule.createdBy !== userId && !isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权查看此日程'
      });
    }

    res.status(200).json({
      status: 'success',
      data: schedule
    });
  } catch (error) {
    console.error('获取日程错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取日程信息过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 创建日程
 */
exports.createSchedule = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const { 
      title, 
      description, 
      startTime, 
      endTime, 
      location, 
      type, 
      priority, 
      participants, 
      isAllDay, 
      reminder,
      recurrence
    } = req.body;
    
    // 验证必填字段
    if (!title || !startTime || !endTime) {
      return next(new AppError('标题、开始时间和结束时间为必填项', 400));
    }
    
    // 验证时间
    const startMoment = moment(startTime);
    const endMoment = moment(endTime);
    
    if (!startMoment.isValid() || !endMoment.isValid()) {
      return next(new AppError('无效的时间格式', 400));
    }
    
    if (endMoment.isBefore(startMoment)) {
      return next(new AppError('结束时间不能早于开始时间', 400));
    }
    
    // 验证类型
    const validTypes = ['meeting', 'appointment', 'task', 'other'];
    if (type && !validTypes.includes(type)) {
      return next(new AppError('无效的日程类型', 400));
    }
    
    // 验证优先级
    const validPriorities = ['high', 'medium', 'low'];
    if (priority && !validPriorities.includes(priority)) {
      return next(new AppError('无效的优先级', 400));
    }
    
    // 验证提醒设置
    const validReminders = [null, 0, 5, 10, 15, 30, 60, 1440, 2880];
    if (reminder && !validReminders.includes(reminder)) {
      return next(new AppError('无效的提醒设置', 400));
    }
    
    // 创建日程
    const schedule = await Schedule.create({
      title,
      description: description || null,
      startTime: startMoment.toDate(),
      endTime: endMoment.toDate(),
      location: location || null,
      type: type || 'other',
      priority: priority || 'medium',
      creatorId,
      isAllDay: isAllDay || false,
      reminder: reminder,
      recurrence: recurrence || null,
      status: 'active'
    });
    
    // 添加参与者
    let participantRecords = [];
    if (participants && Array.isArray(participants) && participants.length > 0) {
      // 验证参与者信息
      for (const participant of participants) {
        if (!participant.type || !['user', 'department'].includes(participant.type)) {
          return next(new AppError('参与者类型无效', 400));
        }
        
        if (!participant.id) {
          return next(new AppError('参与者ID不能为空', 400));
        }
        
        // 验证用户或部门是否存在
        if (participant.type === 'user') {
          const user = await User.findByPk(participant.id);
          if (!user) {
            return next(new AppError(`用户ID为${participant.id}的用户不存在`, 404));
          }
        } else if (participant.type === 'department') {
          const department = await Department.findByPk(participant.id);
          if (!department) {
            return next(new AppError(`部门ID为${participant.id}的部门不存在`, 404));
          }
        }
      }
      
      // 创建参与者记录
      participantRecords = participants.map(participant => ({
        scheduleId: schedule.id,
        participantType: participant.type,
        participantId: participant.id,
        status: 'pending'
      }));
      
      // 将创建者作为参与者，状态为已接受
      const creatorParticipant = {
        scheduleId: schedule.id,
        participantType: 'user',
        participantId: creatorId,
        status: 'accepted'
      };
      
      // 确保创建者不会被重复添加
      const isCreatorIncluded = participantRecords.some(
        p => p.participantType === 'user' && p.participantId === creatorId
      );
      
      if (!isCreatorIncluded) {
        participantRecords.push(creatorParticipant);
      } else {
        // 如果创建者已经在参与者列表中，将其状态改为已接受
        const creatorIndex = participantRecords.findIndex(
          p => p.participantType === 'user' && p.participantId === creatorId
        );
        participantRecords[creatorIndex].status = 'accepted';
      }
      
      await ScheduleParticipant.bulkCreate(participantRecords);
    } else {
      // 如果没有指定参与者，至少将创建者添加为参与者
      await ScheduleParticipant.create({
        scheduleId: schedule.id,
        participantType: 'user',
        participantId: creatorId,
        status: 'accepted'
      });
    }
    
    // 获取创建的日程，包括参与者信息
    const result = await Schedule.findByPk(schedule.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'name'] },
        { model: ScheduleParticipant, as: 'participants' }
      ]
    });
    
    res.status(201).json({
      status: 'success',
      message: '日程创建成功',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取日程列表
 */
exports.getSchedules = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userDepartmentId = req.user.departmentId;
    
    // 时间范围过滤
    const start = req.query.start ? moment(req.query.start).startOf('day').toDate() : moment().startOf('month').toDate();
    const end = req.query.end ? moment(req.query.end).endOf('day').toDate() : moment().endOf('month').toDate();
    
    // 其他查询参数
    const type = req.query.type;
    const priority = req.query.priority;
    const status = req.query.status || 'active';
    const search = req.query.search || '';
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 构建日程查询条件
    const scheduleWhere = {
      [Op.or]: [
        // 日程在所选时间范围内开始
        { startTime: { [Op.between]: [start, end] } },
        // 日程在所选时间范围内结束
        { endTime: { [Op.between]: [start, end] } },
        // 日程跨越所选时间范围
        {
          [Op.and]: [
            { startTime: { [Op.lte]: start } },
            { endTime: { [Op.gte]: end } }
          ]
        }
      ],
      status: status
    };
    
    if (type) {
      scheduleWhere.type = type;
    }
    
    if (priority) {
      scheduleWhere.priority = priority;
    }
    
    if (search) {
      scheduleWhere[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // 获取用户参与的日程
    const { count, rows } = await Schedule.findAndCountAll({
      where: scheduleWhere,
      include: [
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'username', 'name'] 
        },
        {
          model: ScheduleParticipant,
          as: 'participants',
          where: {
            [Op.or]: [
              // 用户作为直接参与者
              { participantType: 'user', participantId: userId },
              // 用户所在部门作为参与者
              { participantType: 'department', participantId: userDepartmentId }
            ]
          },
          required: true
        }
      ],
      distinct: true,
      order: [
        ['priority', 'DESC'],
        ['startTime', 'ASC']
      ],
      limit,
      offset
    });
    
    // 获取用户对每个日程的参与状态
    const schedulesWithUserStatus = await Promise.all(rows.map(async (schedule) => {
      const userParticipant = await ScheduleParticipant.findOne({
        where: {
          scheduleId: schedule.id,
          participantType: 'user',
          participantId: userId
        }
      });
      
      return {
        ...schedule.toJSON(),
        userStatus: userParticipant ? userParticipant.status : null
      };
    }));
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取日程列表成功',
      data: schedulesWithUserStatus,
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
 * 获取日程详情
 */
exports.getScheduleById = async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const userId = req.user.id;
    
    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'name', 'email', 'phone'] },
        { 
          model: ScheduleParticipant, 
          as: 'participants',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'name', 'email', 'phone', 'avatar']
            },
            {
              model: Department,
              as: 'department',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });
    
    if (!schedule) {
      return next(new AppError('日程不存在', 404));
    }
    
    // 检查用户是否有权限查看此日程
    const userParticipant = await ScheduleParticipant.findOne({
      where: {
        scheduleId,
        [Op.or]: [
          { participantType: 'user', participantId: userId },
          { participantType: 'department', participantId: req.user.departmentId }
        ]
      }
    });
    
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isCreator = schedule.creatorId === userId;
    
    if (!isAdmin && !isCreator && !userParticipant) {
      return next(new AppError('您没有权限查看此日程', 403));
    }
    
    // 获取用户的参与状态
    const userStatus = userParticipant ? userParticipant.status : null;
    
    // 获取统计信息
    const participantsStats = {
      total: 0,
      accepted: 0,
      pending: 0,
      declined: 0
    };
    
    if (schedule.participants) {
      for (const participant of schedule.participants) {
        if (participant.participantType === 'user') {
          participantsStats.total++;
          if (participant.status === 'accepted') participantsStats.accepted++;
          if (participant.status === 'pending') participantsStats.pending++;
          if (participant.status === 'declined') participantsStats.declined++;
        } else if (participant.participantType === 'department') {
          // 计算部门人数
          const departmentUserCount = await User.count({
            where: { 
              departmentId: participant.participantId,
              status: 'active'
            }
          });
          participantsStats.total += departmentUserCount;
          participantsStats.pending += departmentUserCount; // 默认部门所有成员为待定状态
        }
      }
    }
    
    // 计算是否有冲突的日程
    const conflictingSchedules = await Schedule.findAll({
      where: {
        id: { [Op.ne]: scheduleId },
        status: 'active',
        [Op.or]: [
          // 在开始时间和结束时间之间
          {
            startTime: {
              [Op.lt]: schedule.endTime,
              [Op.gt]: schedule.startTime
            }
          },
          // 包含开始时间
          {
            startTime: { [Op.lte]: schedule.startTime },
            endTime: { [Op.gt]: schedule.startTime }
          },
          // 包含结束时间
          {
            startTime: { [Op.lt]: schedule.endTime },
            endTime: { [Op.gte]: schedule.endTime }
          }
        ]
      },
      include: [
        {
          model: ScheduleParticipant,
          as: 'participants',
          where: {
            participantType: 'user',
            participantId: userId
          },
          required: true
        }
      ]
    });
    
    const scheduleWithInfo = {
      ...schedule.toJSON(),
      userStatus,
      participantsStats,
      hasConflicts: conflictingSchedules.length > 0,
      conflictingSchedules: conflictingSchedules.map(s => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime
      }))
    };
    
    res.status(200).json({
      status: 'success',
      message: '获取日程详情成功',
      data: scheduleWithInfo
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新日程参与状态
 */
exports.updateParticipantStatus = async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const userId = req.user.id;
    const { status } = req.body;
    
    // 验证状态
    if (!status || !['accepted', 'pending', 'declined'].includes(status)) {
      return next(new AppError('无效的参与状态', 400));
    }
    
    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId);
    
    if (!schedule) {
      return next(new AppError('日程不存在', 404));
    }
    
    // 检查用户是否是参与者
    const userParticipant = await ScheduleParticipant.findOne({
      where: {
        scheduleId,
        participantType: 'user',
        participantId: userId
      }
    });
    
    if (!userParticipant) {
      // 检查用户所在部门是否是参与者
      const departmentParticipant = await ScheduleParticipant.findOne({
        where: {
          scheduleId,
          participantType: 'department',
          participantId: req.user.departmentId
        }
      });
      
      if (!departmentParticipant) {
        return next(new AppError('您不是此日程的参与者', 403));
      }
      
      // 如果用户所在部门是参与者，为用户创建一个参与记录
      await ScheduleParticipant.create({
        scheduleId,
        participantType: 'user',
        participantId: userId,
        status
      });
    } else {
      // 更新用户的参与状态
      await userParticipant.update({ status });
    }
    
    res.status(200).json({
      status: 'success',
      message: '日程参与状态更新成功',
      data: { scheduleId, userId, status }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新日程
 */
exports.updateSchedule = async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const userId = req.user.id;
    
    const { 
      title, 
      description, 
      startTime, 
      endTime, 
      location, 
      type, 
      priority, 
      participants, 
      isAllDay, 
      reminder,
      recurrence,
      status
    } = req.body;
    
    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId);
    
    if (!schedule) {
      return next(new AppError('日程不存在', 404));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && schedule.creatorId !== userId) {
      return next(new AppError('您没有权限更新此日程', 403));
    }
    
    // 验证时间
    let startMoment = null;
    let endMoment = null;
    
    if (startTime) {
      startMoment = moment(startTime);
      if (!startMoment.isValid()) {
        return next(new AppError('无效的开始时间格式', 400));
      }
    }
    
    if (endTime) {
      endMoment = moment(endTime);
      if (!endMoment.isValid()) {
        return next(new AppError('无效的结束时间格式', 400));
      }
    }
    
    if (startMoment && endMoment && endMoment.isBefore(startMoment)) {
      return next(new AppError('结束时间不能早于开始时间', 400));
    }
    
    // 验证类型
    if (type && !['meeting', 'appointment', 'task', 'other'].includes(type)) {
      return next(new AppError('无效的日程类型', 400));
    }
    
    // 验证优先级
    if (priority && !['high', 'medium', 'low'].includes(priority)) {
      return next(new AppError('无效的优先级', 400));
    }
    
    // 验证状态
    if (status && !['active', 'cancelled', 'completed'].includes(status)) {
      return next(new AppError('无效的日程状态', 400));
    }
    
    // 验证提醒设置
    const validReminders = [null, 0, 5, 10, 15, 30, 60, 1440, 2880];
    if (reminder !== undefined && !validReminders.includes(reminder)) {
      return next(new AppError('无效的提醒设置', 400));
    }
    
    // 更新日程
    await schedule.update({
      title: title || schedule.title,
      description: description !== undefined ? description : schedule.description,
      startTime: startMoment ? startMoment.toDate() : schedule.startTime,
      endTime: endMoment ? endMoment.toDate() : schedule.endTime,
      location: location !== undefined ? location : schedule.location,
      type: type || schedule.type,
      priority: priority || schedule.priority,
      isAllDay: isAllDay !== undefined ? isAllDay : schedule.isAllDay,
      reminder: reminder !== undefined ? reminder : schedule.reminder,
      recurrence: recurrence !== undefined ? recurrence : schedule.recurrence,
      status: status || schedule.status,
      updatedAt: new Date()
    });
    
    // 如果更新了参与者
    if (participants && Array.isArray(participants)) {
      // 获取当前参与者
      const currentParticipants = await ScheduleParticipant.findAll({
        where: { scheduleId }
      });
      
      // 保持创建者作为参与者
      const creatorParticipant = currentParticipants.find(
        p => p.participantType === 'user' && p.participantId === schedule.creatorId
      );
      
      // 删除旧参与者
      await ScheduleParticipant.destroy({
        where: { 
          scheduleId,
          // 不删除创建者
          [Op.not]: [
            { participantType: 'user', participantId: schedule.creatorId }
          ]
        }
      });
      
      // 添加新参与者
      const newParticipants = participants.filter(
        p => !(p.type === 'user' && p.id === schedule.creatorId)
      ).map(p => ({
        scheduleId,
        participantType: p.type,
        participantId: p.id,
        status: 'pending'
      }));
      
      if (newParticipants.length > 0) {
        await ScheduleParticipant.bulkCreate(newParticipants);
      }
      
      // 如果创建者不在新参与者列表中，确保其仍然保留
      const isCreatorIncluded = participants.some(
        p => p.type === 'user' && p.id === schedule.creatorId
      );
      
      if (!isCreatorIncluded && creatorParticipant) {
        // 确保创建者仍然是参与者
        await ScheduleParticipant.create({
          scheduleId,
          participantType: 'user',
          participantId: schedule.creatorId,
          status: 'accepted'
        });
      }
    }
    
    // 获取更新后的日程
    const updatedSchedule = await Schedule.findByPk(scheduleId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'name'] },
        { model: ScheduleParticipant, as: 'participants' }
      ]
    });
    
    res.status(200).json({
      status: 'success',
      message: '日程更新成功',
      data: updatedSchedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除日程
 */
exports.deleteSchedule = async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const userId = req.user.id;
    
    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId);
    
    if (!schedule) {
      return next(new AppError('日程不存在', 404));
    }
    
    // 检查权限
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin && schedule.creatorId !== userId) {
      return next(new AppError('您没有权限删除此日程', 403));
    }
    
    // 删除日程参与者
    await ScheduleParticipant.destroy({
      where: { scheduleId }
    });
    
    // 删除日程
    await schedule.destroy();
    
    res.status(200).json({
      status: 'success',
      message: '日程删除成功'
    });
  } catch (error) {
    next(error);
  }
}; 