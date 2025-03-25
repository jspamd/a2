const bcrypt = require('bcrypt');
const db = require('../models');
const { User, Role, Permission, Department } = db;

/**
 * 初始化系统基础数据
 */
const initializeSystemData = async () => {
  try {
    console.log('开始初始化系统基础数据...');
    
    // 检查管理员角色是否存在
    let adminRole = await Role.findOne({ where: { code: 'admin' } });
    
    if (!adminRole) {
      console.log('创建基础角色...');
      
      // 创建基础角色
      adminRole = await Role.create({
        name: '系统管理员',
        code: 'admin',
        description: '系统管理员，拥有所有权限',
        status: 'active',
        rank: 1
      });
      
      await Role.bulkCreate([
        {
          name: '部门经理',
          code: 'manager',
          description: '部门管理者，拥有部门管理权限',
          status: 'active',
          rank: 2
        },
        {
          name: '普通员工',
          code: 'employee',
          description: '普通员工，拥有基本操作权限',
          status: 'active',
          rank: 3
        }
      ]);
      
      console.log('基础角色创建完成');
    }
    
    // 检查根部门是否存在
    let rootDepartment = await Department.findOne({ where: { code: 'root' } });
    
    if (!rootDepartment) {
      console.log('创建基础部门结构...');
      
      // 创建公司根部门
      rootDepartment = await Department.create({
        name: '公司',
        code: 'root',
        description: '公司根部门',
        parentId: null,
        status: 'active'
      });
      
      // 创建基础部门
      await Department.bulkCreate([
        {
          name: '行政部',
          code: 'admin_dept',
          description: '行政管理部门',
          parentId: rootDepartment.id,
          status: 'active'
        },
        {
          name: '人力资源部',
          code: 'hr_dept',
          description: '人力资源管理部门',
          parentId: rootDepartment.id,
          status: 'active'
        },
        {
          name: '技术部',
          code: 'tech_dept',
          description: '技术研发部门',
          parentId: rootDepartment.id,
          status: 'active'
        },
        {
          name: '财务部',
          code: 'finance_dept',
          description: '财务管理部门',
          parentId: rootDepartment.id,
          status: 'active'
        }
      ]);
      
      console.log('基础部门创建完成');
    }
    
    // 检查管理员用户是否存在
    let adminUser = await User.findOne({ where: { username: 'admin' } });
    
    if (!adminUser) {
      console.log('创建管理员账号...');
      
      // 创建超级管理员账号
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser = await User.create({
        username: 'admin',
        password: hashedPassword,
        name: '系统管理员',
        email: 'admin@example.com',
        status: 'active',
        departmentId: rootDepartment.id
      });
      
      // 将管理员与管理员角色关联
      await adminUser.addRole(adminRole);
      
      console.log('管理员账号创建完成');
    }
    
    // 检查基础权限是否存在
    const permissionCount = await Permission.count();
    
    if (permissionCount === 0) {
      console.log('创建基础权限...');
      
      // 创建基础权限
      const modules = ['user', 'role', 'department', 'workflow', 'document', 'attendance', 'announcement', 'schedule'];
      const actions = ['create', 'read', 'update', 'delete', 'approve', 'manage'];
      
      const permissions = [];
      
      modules.forEach(module => {
        actions.forEach(action => {
          permissions.push({
            name: `${module}.${action}`,
            code: `${module}:${action}`,
            description: `${action} permission for ${module}`,
            module: module,
            action: action
          });
        });
      });
      
      await Permission.bulkCreate(permissions);
      
      // 为管理员角色分配所有权限
      const allPermissions = await Permission.findAll();
      await adminRole.addPermissions(allPermissions);
      
      console.log('基础权限创建完成');
    }
    
    console.log('系统基础数据初始化完成');
    
  } catch (error) {
    console.error('初始化系统数据出错:', error);
    throw error;
  }
};

module.exports = { initializeSystemData }; 