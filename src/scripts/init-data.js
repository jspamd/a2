const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');
const {
  User,
  Department,
  Role,
  Permission,
  DocumentCategory,
  AttendanceRule,
  establishAssociations
} = require('../models');

/**
 * 初始化权限数据
 */
const initPermissions = async () => {
  console.log('正在初始化权限数据...');
  
  // 创建基础权限
  const permissionsData = [
    // 系统管理
    { name: '系统管理', code: 'system', type: 'menu', parentId: 0, order: 1 },
    { name: '用户管理', code: 'user', type: 'menu', parentId: 1, order: 1 },
    { name: '用户查看', code: 'user:view', type: 'operation', parentId: 2, order: 1 },
    { name: '用户创建', code: 'user:create', type: 'operation', parentId: 2, order: 2 },
    { name: '用户编辑', code: 'user:edit', type: 'operation', parentId: 2, order: 3 },
    { name: '用户删除', code: 'user:delete', type: 'operation', parentId: 2, order: 4 },
    
    { name: '角色管理', code: 'role', type: 'menu', parentId: 1, order: 2 },
    { name: '角色查看', code: 'role:view', type: 'operation', parentId: 7, order: 1 },
    { name: '角色创建', code: 'role:create', type: 'operation', parentId: 7, order: 2 },
    { name: '角色编辑', code: 'role:edit', type: 'operation', parentId: 7, order: 3 },
    { name: '角色删除', code: 'role:delete', type: 'operation', parentId: 7, order: 4 },
    
    { name: '部门管理', code: 'department', type: 'menu', parentId: 1, order: 3 },
    { name: '部门查看', code: 'department:view', type: 'operation', parentId: 12, order: 1 },
    { name: '部门创建', code: 'department:create', type: 'operation', parentId: 12, order: 2 },
    { name: '部门编辑', code: 'department:edit', type: 'operation', parentId: 12, order: 3 },
    { name: '部门删除', code: 'department:delete', type: 'operation', parentId: 12, order: 4 },
    
    // 工作流管理
    { name: '工作流管理', code: 'workflow', type: 'menu', parentId: 0, order: 2 },
    { name: '工作流定义', code: 'workflow:definition', type: 'menu', parentId: 17, order: 1 },
    { name: '工作流实例', code: 'workflow:instance', type: 'menu', parentId: 17, order: 2 },
    { name: '我的申请', code: 'workflow:my', type: 'menu', parentId: 17, order: 3 },
    { name: '待办任务', code: 'workflow:todo', type: 'menu', parentId: 17, order: 4 },
    
    // 文档管理
    { name: '文档管理', code: 'document', type: 'menu', parentId: 0, order: 3 },
    { name: '文档分类', code: 'document:category', type: 'menu', parentId: 22, order: 1 },
    { name: '文档列表', code: 'document:list', type: 'menu', parentId: 22, order: 2 },
    { name: '我的文档', code: 'document:my', type: 'menu', parentId: 22, order: 3 },
    { name: '文档搜索', code: 'document:search', type: 'menu', parentId: 22, order: 4 },
    
    // 考勤管理
    { name: '考勤管理', code: 'attendance', type: 'menu', parentId: 0, order: 4 },
    { name: '考勤规则', code: 'attendance:rule', type: 'menu', parentId: 27, order: 1 },
    { name: '签到记录', code: 'attendance:record', type: 'menu', parentId: 27, order: 2 },
    { name: '请假管理', code: 'attendance:leave', type: 'menu', parentId: 27, order: 3 },
    { name: '加班管理', code: 'attendance:overtime', type: 'menu', parentId: 27, order: 4 },
    { name: '考勤统计', code: 'attendance:statistics', type: 'menu', parentId: 27, order: 5 },
    
    // 公告通知
    { name: '公告通知', code: 'announcement', type: 'menu', parentId: 0, order: 5 },
    { name: '公告管理', code: 'announcement:manage', type: 'menu', parentId: 33, order: 1 },
    { name: '我的消息', code: 'announcement:message', type: 'menu', parentId: 33, order: 2 },
    
    // 日程管理
    { name: '日程管理', code: 'schedule', type: 'menu', parentId: 0, order: 6 },
    { name: '我的日程', code: 'schedule:my', type: 'menu', parentId: 36, order: 1 },
    { name: '团队日程', code: 'schedule:team', type: 'menu', parentId: 36, order: 2 },
    { name: '会议室管理', code: 'schedule:meeting-room', type: 'menu', parentId: 36, order: 3 }
  ];

  for (const permission of permissionsData) {
    await Permission.findOrCreate({
      where: { code: permission.code },
      defaults: permission
    });
  }

  console.log('权限数据初始化完成');
};

/**
 * 初始化角色数据
 */
const initRoles = async () => {
  console.log('正在初始化角色数据...');
  
  // 创建基础角色
  const rolesData = [
    { name: '超级管理员', code: 'super_admin', description: '系统超级管理员，拥有所有权限', isSystem: true, order: 1 },
    { name: '管理员', code: 'admin', description: '系统管理员，拥有大部分管理权限', isSystem: true, order: 2 },
    { name: '部门主管', code: 'manager', description: '部门主管，拥有部门管理权限', isSystem: true, order: 3 },
    { name: '普通员工', code: 'employee', description: '普通员工，拥有基本操作权限', isSystem: true, order: 4 }
  ];
  
  for (const role of rolesData) {
    await Role.findOrCreate({
      where: { code: role.code },
      defaults: role
    });
  }

  // 分配权限给角色
  const superAdmin = await Role.findOne({ where: { code: 'super_admin' } });
  const admin = await Role.findOne({ where: { code: 'admin' } });
  const manager = await Role.findOne({ where: { code: 'manager' } });
  const employee = await Role.findOne({ where: { code: 'employee' } });
  
  // 超级管理员拥有所有权限
  const allPermissions = await Permission.findAll();
  await superAdmin.setPermissions(allPermissions);
  
  // 管理员权限
  const adminPermissions = await Permission.findAll({
    where: {
      code: {
        [Op.notIn]: ['user:delete', 'role:delete', 'department:delete']
      }
    }
  });
  await admin.setPermissions(adminPermissions);
  
  // 部门主管权限
  const managerPermissions = await Permission.findAll({
    where: {
      code: {
        [Op.in]: [
          'user:view', 'department:view',
          'workflow:definition', 'workflow:instance', 'workflow:my', 'workflow:todo',
          'document:category', 'document:list', 'document:my', 'document:search',
          'attendance:rule', 'attendance:record', 'attendance:leave', 'attendance:overtime', 'attendance:statistics',
          'announcement:manage', 'announcement:message',
          'schedule:my', 'schedule:team', 'schedule:meeting-room'
        ]
      }
    }
  });
  await manager.setPermissions(managerPermissions);
  
  // 普通员工权限
  const employeePermissions = await Permission.findAll({
    where: {
      code: {
        [Op.in]: [
          'workflow:my', 'workflow:todo',
          'document:list', 'document:my', 'document:search',
          'attendance:record', 'attendance:leave', 'attendance:overtime',
          'announcement:message',
          'schedule:my', 'schedule:team'
        ]
      }
    }
  });
  await employee.setPermissions(employeePermissions);

  console.log('角色数据初始化完成');
};

/**
 * 初始化部门数据
 */
const initDepartments = async () => {
  console.log('正在初始化部门数据...');
  
  // 创建基础部门
  const departmentsData = [
    { name: '总经办', code: 'CEO-OFFICE', level: 1, parentId: 0, order: 1 },
    { name: '人力资源部', code: 'HR', level: 1, parentId: 0, order: 2 },
    { name: '财务部', code: 'FINANCE', level: 1, parentId: 0, order: 3 },
    { name: '技术部', code: 'TECH', level: 1, parentId: 0, order: 4 },
    { name: '市场部', code: 'MARKETING', level: 1, parentId: 0, order: 5 },
    { name: '销售部', code: 'SALES', level: 1, parentId: 0, order: 6 },
    { name: '客服部', code: 'CUSTOMER-SERVICE', level: 1, parentId: 0, order: 7 },
    
    { name: '招聘组', code: 'HR-RECRUITING', level: 2, parentId: 2, order: 1, path: '2' },
    { name: '培训组', code: 'HR-TRAINING', level: 2, parentId: 2, order: 2, path: '2' },
    
    { name: '前端组', code: 'TECH-FRONTEND', level: 2, parentId: 4, order: 1, path: '4' },
    { name: '后端组', code: 'TECH-BACKEND', level: 2, parentId: 4, order: 2, path: '4' },
    { name: '测试组', code: 'TECH-QA', level: 2, parentId: 4, order: 3, path: '4' },
    { name: '运维组', code: 'TECH-OPS', level: 2, parentId: 4, order: 4, path: '4' }
  ];
  
  for (const dept of departmentsData) {
    await Department.findOrCreate({
      where: { code: dept.code },
      defaults: dept
    });
  }

  console.log('部门数据初始化完成');
};

/**
 * 初始化用户数据
 */
const initUsers = async () => {
  console.log('正在初始化用户数据...');
  
  // 获取角色
  const superAdminRole = await Role.findOne({ where: { code: 'super_admin' } });
  const adminRole = await Role.findOne({ where: { code: 'admin' } });
  const managerRole = await Role.findOne({ where: { code: 'manager' } });
  const employeeRole = await Role.findOne({ where: { code: 'employee' } });
  
  // 获取部门
  const ceoOffice = await Department.findOne({ where: { code: 'CEO-OFFICE' } });
  const hrDept = await Department.findOne({ where: { code: 'HR' } });
  const techDept = await Department.findOne({ where: { code: 'TECH' } });
  
  // 创建基础用户
  const usersData = [
    {
      username: 'admin',
      password: 'admin123',
      name: '系统管理员',
      employeeId: 'EMP001',
      email: 'admin@example.com',
      departmentId: ceoOffice.id,
      roleId: superAdminRole.id,
      position: '超级管理员',
      entryDate: new Date('2020-01-01')
    },
    {
      username: 'hr_manager',
      password: 'hr123456',
      name: '人事经理',
      employeeId: 'EMP002',
      email: 'hr@example.com',
      departmentId: hrDept.id,
      roleId: managerRole.id,
      position: '人力资源经理',
      entryDate: new Date('2020-02-01')
    },
    {
      username: 'tech_manager',
      password: 'tech123456',
      name: '技术经理',
      employeeId: 'EMP003',
      email: 'tech@example.com',
      departmentId: techDept.id,
      roleId: managerRole.id,
      position: '技术经理',
      entryDate: new Date('2020-03-01')
    },
    {
      username: 'employee1',
      password: 'emp123456',
      name: '张三',
      employeeId: 'EMP004',
      email: 'employee1@example.com',
      departmentId: techDept.id,
      roleId: employeeRole.id,
      position: '开发工程师',
      entryDate: new Date('2021-01-01')
    },
    {
      username: 'employee2',
      password: 'emp123456',
      name: '李四',
      employeeId: 'EMP005',
      email: 'employee2@example.com',
      departmentId: hrDept.id,
      roleId: employeeRole.id,
      position: '人力资源专员',
      entryDate: new Date('2021-02-01')
    }
  ];
  
  for (const userData of usersData) {
    // 查找用户是否已存在
    const existingUser = await User.findOne({ where: { username: userData.username } });
    if (!existingUser) {
      // 手动加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({
        ...userData,
        password: hashedPassword
      });
    }
  }

  console.log('用户数据初始化完成');
};

/**
 * 初始化文档分类数据
 */
const initDocumentCategories = async () => {
  console.log('正在初始化文档分类数据...');
  
  // 创建基础文档分类
  const categoriesData = [
    { name: '公司制度', code: 'company-policy', level: 1, parentId: 0, order: 1, createdBy: 1 },
    { name: '部门文档', code: 'department-doc', level: 1, parentId: 0, order: 2, createdBy: 1 },
    { name: '项目文档', code: 'project-doc', level: 1, parentId: 0, order: 3, createdBy: 1 },
    { name: '培训资料', code: 'training', level: 1, parentId: 0, order: 4, createdBy: 1 },
    { name: '会议纪要', code: 'meeting', level: 1, parentId: 0, order: 5, createdBy: 1 },
    
    { name: '人事制度', code: 'hr-policy', level: 2, parentId: 1, path: '1', order: 1, createdBy: 1 },
    { name: '财务制度', code: 'finance-policy', level: 2, parentId: 1, path: '1', order: 2, createdBy: 1 },
    { name: '行政制度', code: 'admin-policy', level: 2, parentId: 1, path: '1', order: 3, createdBy: 1 },
    
    { name: '人力资源部', code: 'hr-dept', level: 2, parentId: 2, path: '2', order: 1, createdBy: 1 },
    { name: '技术部', code: 'tech-dept', level: 2, parentId: 2, path: '2', order: 2, createdBy: 1 },
    { name: '财务部', code: 'finance-dept', level: 2, parentId: 2, path: '2', order: 3, createdBy: 1 },
    
    { name: '技术培训', code: 'tech-training', level: 2, parentId: 4, path: '4', order: 1, createdBy: 1 },
    { name: '管理培训', code: 'management-training', level: 2, parentId: 4, path: '4', order: 2, createdBy: 1 },
    { name: '新员工培训', code: 'new-employee-training', level: 2, parentId: 4, path: '4', order: 3, createdBy: 1 }
  ];
  
  for (const category of categoriesData) {
    await DocumentCategory.findOrCreate({
      where: { code: category.code },
      defaults: category
    });
  }

  console.log('文档分类数据初始化完成');
};

/**
 * 初始化考勤规则数据
 */
const initAttendanceRules = async () => {
  console.log('正在初始化考勤规则数据...');
  
  // 创建基础考勤规则
  const rulesData = [
    {
      name: '标准工作制',
      workdayStart: '09:00:00',
      workdayEnd: '18:00:00',
      workdayLateTolerance: 15,
      workdayEarlyTolerance: 15,
      lunchBreakStart: '12:00:00',
      lunchBreakEnd: '14:00:00',
      workdays: '1,2,3,4,5',
      flexibleWork: false,
      status: 'active',
      description: '标准朝九晚六工作制',
      createdBy: 1
    },
    {
      name: '弹性工作制',
      workdayStart: '08:00:00',
      workdayEnd: '19:00:00',
      workdayLateTolerance: 30,
      workdayEarlyTolerance: 30,
      lunchBreakStart: '12:00:00',
      lunchBreakEnd: '14:00:00',
      workdays: '1,2,3,4,5',
      flexibleWork: true,
      flexibleWorkHours: 8,
      status: 'active',
      description: '弹性工作制，每日工作8小时',
      createdBy: 1
    }
  ];
  
  for (const rule of rulesData) {
    await AttendanceRule.findOrCreate({
      where: { name: rule.name },
      defaults: rule
    });
  }

  console.log('考勤规则数据初始化完成');
};

/**
 * 执行所有初始化
 */
const init = async () => {
  try {
    // 建立模型关联
    establishAssociations();
    
    // 同步数据库模型
    await sequelize.sync({ alter: true });
    
    // 初始化数据
    await initPermissions();
    await initRoles();
    await initDepartments();
    await initUsers();
    await initDocumentCategories();
    await initAttendanceRules();
    
    console.log('数据初始化完成');
    process.exit(0);
  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
};

// 执行初始化
init();