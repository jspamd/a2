const bcrypt = require('bcrypt');
const { User, Role } = require('../models');

async function initAdmin() {
  try {
    // 检查是否已存在管理员用户
    let adminUser = await User.findOne({
      where: { username: 'admin' }
    });

    if (!adminUser) {
      // 创建管理员角色
      const adminRole = await Role.findOrCreate({
        where: { name: 'admin' },
        defaults: {
          name: 'admin',
          description: '系统管理员'
        }
      });

      // 创建管理员用户
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser = await User.create({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        fullName: '系统管理员',
        role: 'admin',
        status: 'active'
      });

      console.log('管理员用户创建成功');
    } else {
      console.log('管理员用户已存在');
    }
  } catch (error) {
    console.error('初始化管理员用户失败:', error);
  }
}

// 执行初始化
initAdmin(); 