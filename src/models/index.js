const { Sequelize } = require('sequelize');
const dbConnect = require('../config/database');
const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { logger } = require('../utils/logger');

// 加载环境变量
dotenv.config();

// 导入所有模型
const db = {};

try {
  // 导入基础模型
  logger.info('正在加载基础模型...');
  const User = require('./user.model')(sequelize, Sequelize.DataTypes);
  const Role = require('./role.model')(sequelize, Sequelize.DataTypes);
  const Department = require('./department.model')(sequelize, Sequelize.DataTypes);
  const Permission = require('./permission.model')(sequelize, Sequelize.DataTypes);

  // 导入工作流模型
  logger.info('正在加载工作流模型...');
  const { 
    WorkflowDefinition, 
    WorkflowInstance, 
    WorkflowNodeInstance 
  } = require('./workflow.model')(sequelize, Sequelize.DataTypes);

  // 导入文档模型
  logger.info('正在加载文档模型...');
  const { 
    DocumentCategory,
    Document, 
    DocumentPermission,
    Folder, 
    DocumentShare, 
    DocumentVersion,
    defineAssociations: defineDocumentAssociations
  } = require('./document.model')(sequelize, Sequelize.DataTypes);

  // 导入考勤模型
  logger.info('正在加载考勤模型...');
  const { 
    AttendanceRule,
    DepartmentAttendanceRule,
    AttendanceRecord, 
    LeaveRecord, 
    OvertimeRecord 
  } = require('./attendance.model')(sequelize, Sequelize.DataTypes);

  // 导入公告模型
  logger.info('正在加载公告模型...');
  const { 
    Announcement, 
    AnnouncementTarget, 
    AnnouncementRead 
  } = require('./announcement.model')(sequelize, Sequelize.DataTypes);

  // 导入日程模型
  logger.info('正在加载日程模型...');
  const { 
    Schedule, 
    ScheduleParticipant, 
    MeetingRoom, 
    RoomReservation 
  } = require('./schedule.model')(sequelize, Sequelize.DataTypes);

  logger.info('正在设置模型关联关系...');

  // 设置基础模型关联关系
  // 用户和角色 - 多对多关系
  User.belongsToMany(Role, { through: 'UserRoles', timestamps: true });
  Role.belongsToMany(User, { through: 'UserRoles', timestamps: true });

  // 用户和部门 - 多对一关系
  User.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
  Department.hasMany(User, { foreignKey: 'departmentId', as: 'members' });

  // 部门和管理者(用户) - 多对一关系
  Department.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });

  // 角色和权限 - 多对多关系
  Role.belongsToMany(Permission, { through: 'RolePermissions', timestamps: true });
  Permission.belongsToMany(Role, { through: 'RolePermissions', timestamps: true });

  // 部门自关联（上下级关系）
  Department.belongsTo(Department, { foreignKey: 'parentId', as: 'parent' });
  Department.hasMany(Department, { foreignKey: 'parentId', as: 'children' });

  // 工作流关联
  WorkflowInstance.belongsTo(User, { foreignKey: 'initiatorId', as: 'initiator' });
  WorkflowNodeInstance.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

  // 执行文档模型内部关联设置
  defineDocumentAssociations();

  // 文档关联
  Document.belongsTo(User, { foreignKey: 'uploaderId', as: 'uploader' });
  DocumentShare.belongsTo(User, { foreignKey: 'sharedById', as: 'sharedBy' });
  DocumentShare.belongsTo(User, { foreignKey: 'sharedToId', as: 'sharedToUser' });
  DocumentShare.belongsTo(Department, { foreignKey: 'sharedToDeptId', as: 'sharedToDepartment' });
  DocumentShare.belongsTo(Role, { foreignKey: 'sharedToRoleId', as: 'sharedToRole' });
  DocumentVersion.belongsTo(User, { foreignKey: 'updaterId', as: 'updater' });

  // 考勤关联
  AttendanceRecord.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  LeaveRecord.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  LeaveRecord.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  OvertimeRecord.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  OvertimeRecord.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

  // 公告关联
  Announcement.belongsTo(User, { foreignKey: 'publisherId', as: 'publisher' });
  AnnouncementRead.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // 日程关联
  Schedule.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });
  ScheduleParticipant.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  RoomReservation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  logger.info('模型关联关系设置完成');

  // 添加所有模型到导出对象
  db.sequelize = sequelize;
  db.Sequelize = Sequelize;

  // 基础模型
  db.User = User;
  db.Role = Role;
  db.Department = Department;
  db.Permission = Permission;

  // 工作流模型
  db.WorkflowDefinition = WorkflowDefinition;
  db.WorkflowInstance = WorkflowInstance;
  db.WorkflowNodeInstance = WorkflowNodeInstance;

  // 文档模型
  db.DocumentCategory = DocumentCategory;
  db.Document = Document;
  db.DocumentPermission = DocumentPermission;
  db.Folder = Folder;
  db.DocumentShare = DocumentShare;
  db.DocumentVersion = DocumentVersion;

  // 考勤模型
  db.AttendanceRule = AttendanceRule;
  db.DepartmentAttendanceRule = DepartmentAttendanceRule;
  db.AttendanceRecord = AttendanceRecord;
  db.LeaveRecord = LeaveRecord;
  db.OvertimeRecord = OvertimeRecord;

  // 公告模型
  db.Announcement = Announcement;
  db.AnnouncementTarget = AnnouncementTarget;
  db.AnnouncementRead = AnnouncementRead;

  // 日程模型
  db.Schedule = Schedule;
  db.ScheduleParticipant = ScheduleParticipant;
  db.MeetingRoom = MeetingRoom;
  db.RoomReservation = RoomReservation;

  logger.info('所有模型加载完成');

} catch (error) {
  logger.error('加载模型时出错:', error);
  throw error;
}

module.exports = db;