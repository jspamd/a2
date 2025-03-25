const { Schedule, ScheduleParticipant } = require('../models');
const { Sequelize, Op } = require('sequelize');

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
exports.createSchedule = async (req, res) => {
  try {
    const { title, description, location, type, startTime, endTime, isAllDay, participants, reminder } = req.body;
    const userId = req.userId;
    
    // 验证日期
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start > end) {
      return res.status(400).json({
        status: 'error',
        message: '开始时间不能晚于结束时间'
      });
    }
    
    // 创建日程
    const schedule = await Schedule.create({
      title,
      description,
      location,
      type,
      startTime,
      endTime,
      isAllDay: !!isAllDay,
      reminder,
      createdBy: userId
    });

    // 添加参与者
    if (participants && participants.length > 0) {
      const participantRecords = await Promise.all(
        participants.map(async (participantId) => {
          return await ScheduleParticipant.create({
            scheduleId: schedule.id,
            userId: participantId,
            status: 'pending'
          });
        })
      );
      
      // 添加创建者作为已确认的参与者
      await ScheduleParticipant.create({
        scheduleId: schedule.id,
        userId,
        status: 'confirmed'
      });
    }

    // 重新查询日程，包含参与者信息
    const createdSchedule = await Schedule.findByPk(schedule.id, {
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

    res.status(201).json({
      status: 'success',
      message: '日程创建成功',
      data: createdSchedule
    });
  } catch (error) {
    console.error('创建日程错误:', error);
    res.status(500).json({
      status: 'error',
      message: '创建日程过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 更新日程
 */
exports.updateSchedule = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { title, description, location, type, startTime, endTime, isAllDay, reminder } = req.body;
    const userId = req.userId;

    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        status: 'error',
        message: '日程不存在'
      });
    }

    // 检查权限：只有创建者或管理员可以更新
    if (schedule.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权更新此日程'
      });
    }

    // 验证日期
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (start > end) {
        return res.status(400).json({
          status: 'error',
          message: '开始时间不能晚于结束时间'
        });
      }
    }

    // 更新日程
    await schedule.update({
      title,
      description,
      location,
      type,
      startTime,
      endTime,
      isAllDay: isAllDay !== undefined ? !!isAllDay : schedule.isAllDay,
      reminder
    });

    // 重新查询日程，包含参与者信息
    const updatedSchedule = await Schedule.findByPk(scheduleId, {
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

    res.status(200).json({
      status: 'success',
      message: '日程更新成功',
      data: updatedSchedule
    });
  } catch (error) {
    console.error('更新日程错误:', error);
    res.status(500).json({
      status: 'error',
      message: '更新日程过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 删除日程
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const userId = req.userId;

    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        status: 'error',
        message: '日程不存在'
      });
    }

    // 检查权限：只有创建者或管理员可以删除
    if (schedule.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权删除此日程'
      });
    }

    // 删除日程及相关参与者记录
    await schedule.destroy();

    res.status(200).json({
      status: 'success',
      message: '日程删除成功'
    });
  } catch (error) {
    console.error('删除日程错误:', error);
    res.status(500).json({
      status: 'error',
      message: '删除日程过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 添加日程参与者
 */
exports.addParticipants = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { participants } = req.body;
    const userId = req.userId;

    // 验证参与者列表
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '请提供有效的参与者列表'
      });
    }

    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        status: 'error',
        message: '日程不存在'
      });
    }

    // 检查权限：只有创建者或管理员可以添加参与者
    if (schedule.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权为此日程添加参与者'
      });
    }

    // 查询现有参与者
    const existingParticipants = await ScheduleParticipant.findAll({
      where: {
        scheduleId,
        userId: { [Op.in]: participants }
      }
    });

    // 筛选出新参与者
    const existingUserIds = existingParticipants.map(p => p.userId);
    const newParticipants = participants.filter(id => !existingUserIds.includes(id));

    // 添加新参与者
    if (newParticipants.length > 0) {
      await Promise.all(
        newParticipants.map(async (participantId) => {
          return await ScheduleParticipant.create({
            scheduleId,
            userId: participantId,
            status: 'pending'
          });
        })
      );
    }

    // 重新查询日程，包含参与者信息
    const updatedSchedule = await Schedule.findByPk(scheduleId, {
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

    res.status(200).json({
      status: 'success',
      message: '参与者添加成功',
      data: updatedSchedule
    });
  } catch (error) {
    console.error('添加参与者错误:', error);
    res.status(500).json({
      status: 'error',
      message: '添加参与者过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 设置日程提醒
 */
exports.setReminder = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { reminder } = req.body;
    const userId = req.userId;

    // 查询日程
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        status: 'error',
        message: '日程不存在'
      });
    }

    // 检查权限：创建者、参与者或管理员可以设置提醒
    const isParticipant = await ScheduleParticipant.findOne({
      where: {
        scheduleId,
        userId
      }
    });

    if (schedule.createdBy !== userId && !isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权为此日程设置提醒'
      });
    }

    // 更新日程提醒设置
    await schedule.update({
      reminder
    });

    res.status(200).json({
      status: 'success',
      message: '日程提醒设置成功',
      data: schedule
    });
  } catch (error) {
    console.error('设置日程提醒错误:', error);
    res.status(500).json({
      status: 'error',
      message: '设置日程提醒过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 