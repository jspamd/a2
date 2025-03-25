module.exports = (sequelize, DataTypes) => {
  // 日程模型
  const Schedule = sequelize.define('Schedule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '地点'
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '开始时间'
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '结束时间'
    },
    allDay: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否全天'
    },
    type: {
      type: DataTypes.ENUM('personal', 'meeting', 'appointment', 'reminder', 'task', 'other'),
      defaultValue: 'personal',
      comment: '日程类型'
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal'
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'),
      defaultValue: 'scheduled'
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '日程颜色，用于前端展示'
    },
    isPrivate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否私密日程'
    },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建者ID，关联到User表'
    },
    recurrence: {
      type: DataTypes.ENUM('none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'),
      defaultValue: 'none',
      comment: '重复规则'
    },
    recurrenceRule: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '自定义重复规则'
    },
    recurrenceEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: '重复结束日期'
    },
    remindBefore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '提前提醒分钟数'
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '相关链接，如会议URL'
    },
    attachments: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '附件路径，多个附件用逗号分隔'
    }
  }, {
    timestamps: true,
    paranoid: true  // 软删除
  });

  // 日程参与者
  const ScheduleParticipant = sequelize.define('ScheduleParticipant', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    scheduleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '日程ID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '参与者ID，关联到User表'
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined', 'tentative'),
      defaultValue: 'pending',
      comment: '参与状态'
    },
    responseTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '响应时间'
    },
    comment: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '参与者备注'
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '是否必须参加'
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['scheduleId', 'userId'],
        unique: true
      }
    ]
  });

  // 会议室模型
  const MeetingRoom = sequelize.define('MeetingRoom', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '容纳人数'
    },
    facilities: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '设施，如投影仪、白板等'
    },
    status: {
      type: DataTypes.ENUM('available', 'maintenance', 'reserved'),
      defaultValue: 'available'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    timestamps: true,
    paranoid: true  // 软删除
  });

  // 会议室预约记录
  const RoomReservation = sequelize.define('RoomReservation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '会议室ID'
    },
    scheduleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '关联的日程ID，可为null'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '预约人ID'
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '预约标题'
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '开始时间'
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '结束时间'
    },
    purpose: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '用途'
    },
    participantsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '参与人数'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled', 'completed'),
      defaultValue: 'pending'
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['roomId', 'startTime', 'endTime'],
        name: 'room_reservation_time'
      }
    ]
  });

  // 设置关联关系
  Schedule.hasMany(ScheduleParticipant, { foreignKey: 'scheduleId', as: 'participants' });
  ScheduleParticipant.belongsTo(Schedule, { foreignKey: 'scheduleId' });

  Schedule.hasOne(RoomReservation, { foreignKey: 'scheduleId', as: 'roomReservation' });
  RoomReservation.belongsTo(Schedule, { foreignKey: 'scheduleId' });

  MeetingRoom.hasMany(RoomReservation, { foreignKey: 'roomId', as: 'reservations' });
  RoomReservation.belongsTo(MeetingRoom, { foreignKey: 'roomId', as: 'room' });

  return {
    Schedule,
    ScheduleParticipant,
    MeetingRoom,
    RoomReservation
  };
};