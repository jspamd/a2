// One-shot repair for databases seeded before the UserRoles bind was added.
// Fresh starts are fixed by src/seeders/admin-user.js; this script shares that helper.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('dotenv').config();

const getModels = require('./src/models');
const { ensureAdminUserAndRole } = require('./src/seeders/admin-user');

async function fixAdminRole() {
  let sequelize;
  try {
    console.log('开始修复admin用户角色...');

    const models = await getModels();
    sequelize = models.sequelize;
    await sequelize.authenticate();
    console.log('数据库连接成功');

    const result = await ensureAdminUserAndRole(models);

    if (result.createdUser) {
      console.log('admin用户创建成功，ID:', result.adminUser.id);
    } else {
      console.log('找到admin用户，ID:', result.adminUser.id);
    }

    if (result.createdRole) {
      console.log('admin角色创建成功，ID:', result.adminRole.id);
    } else {
      console.log('找到admin角色，ID:', result.adminRole.id);
    }

    if (result.bound) {
      console.log('用户-角色关联创建成功');
    } else {
      console.log('用户-角色关联已存在');
    }

    console.log('admin用户角色修复完成!');
  } catch (error) {
    console.error('修复过程中出错:', error);
    process.exitCode = 1;
  } finally {
    if (sequelize) {
      try {
        await sequelize.close();
      } catch (closeError) {
        console.error('关闭数据库连接失败:', closeError);
      }
    }
    process.exit(process.exitCode || 0);
  }
}

fixAdminRole();
