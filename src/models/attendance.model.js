module.exports = (sequelize, DataTypes) => {
  // 考勤规则模型
  const AttendanceRule = sequelize.define('AttendanceRule', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '规则名称'
    },
    workdayStart: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: '工作日上班时间'
    },
    workdayEnd: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: '工作日下班时间'
    },
    workdayLateTolerance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '迟到容忍时间(分钟)'
    },
    workdayEarlyTolerance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '早退容忍时间(分钟)'
    },
    lunchBreakStart: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: '午休开始时间'
    },
    lunchBreakEnd: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: '午休结束时间'
    },
    workdays: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '1,2,3,4,5',
      comment: '工作日，使用数字表示星期，1-7表示周一到周日，逗号分隔'
    },
    halfWorkdays: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '半天工作日'
    },
    flexibleWork: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否弹性工作制'
    },
    flexibleWorkHours: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '弹性工作制每日工作小时数'
    },
    overtimeRule: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '加班规则'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      comment: '规则状态'
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '规则描述'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建人ID'
    }
  }, {
    tableName: 'attendance_rules',
    timestamps: true
  });

  // 部门与考勤规则关联模型
  const DepartmentAttendanceRule = sequelize.define('DepartmentAttendanceRule', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '部门ID'
    },
    attendanceRuleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '考勤规则ID'
    },
    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: '生效日期'
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: '失效日期'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      comment: '状态'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建人ID'
    }
  }, {
    tableName: 'department_attendance_rules',
    timestamps: true
  });

  // 签到记录模型
  const AttendanceRecord = sequelize.define('AttendanceRecord', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: '签到日期'
    },
    checkInTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '签到时间'
    },
    checkOutTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '签退时间'
    },
    checkInLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '签到位置'
    },
    checkOutLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '签退位置'
    },
    checkInIp: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '签到IP'
    },
    checkOutIp: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '签退IP'
    },
    checkInDevice: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '签到设备'
    },
    checkOutDevice: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '签退设备'
    },
    status: {
      type: DataTypes.ENUM('normal', 'late', 'early', 'absent', 'leave', 'business', 'overtime'),
      allowNull: true,
      comment: '考勤状态'
    },
    workHours: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '工作时长(小时)'
    },
    lateMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '迟到时间(分钟)'
    },
    earlyMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '早退时间(分钟)'
    },
    remark: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '备注'
    }
  }, {
    tableName: 'attendance_records',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'date']
      }
    ]
  });

  // 请假记录模型
  const LeaveRecord = sequelize.define('LeaveRecord', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    workflowInstanceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '工作流实例ID'
    },
    leaveType: {
      type: DataTypes.ENUM('annual', 'sick', 'personal', 'maternity', 'paternity', 'marriage', 'bereavement', 'other'),
      allowNull: false,
      comment: '请假类型'
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
    duration: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: '请假时长(天)'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '请假原因'
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'canceled'),
      defaultValue: 'draft',
      comment: '状态'
    },
    attachments: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '附件路径，多个用逗号分隔'
    },
    approvalComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '审批意见'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建人ID'
    }
  }, {
    tableName: 'leave_records',
    timestamps: true
  });

  // 加班记录模型
  const OvertimeRecord = sequelize.define('OvertimeRecord', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    workflowInstanceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '工作流实例ID'
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
    duration: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: '加班时长(小时)'
    },
    overtimeType: {
      type: DataTypes.ENUM('workday', 'weekend', 'holiday'),
      allowNull: false,
      comment: '加班类型'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '加班原因'
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'canceled'),
      defaultValue: 'draft',
      comment: '状态'
    },
    approvalComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '审批意见'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建人ID'
    }
  }, {
    tableName: 'overtime_records',
    timestamps: true
  });

  return {
    AttendanceRule,
    DepartmentAttendanceRule,
    AttendanceRecord,
    LeaveRecord,
    OvertimeRecord
  };
};