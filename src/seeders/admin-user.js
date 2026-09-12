const bcrypt = require('bcrypt');
const getModels = require('../models');

const DEFAULT_ADMIN = {
  username: 'admin',
  email: 'admin@example.com',
  name: 'System Administrator',
  password: 'admin123'
};

/**
 * Ensure the admin user, admin role, and UserRoles join row exist.
 * Safe to run on every startup / re-seed (idempotent).
 * Does not reset an existing admin password.
 *
 * @param {{ User: import('sequelize').ModelStatic, Role: import('sequelize').ModelStatic }} models
 * @param {{ password?: string }} [options]
 */
async function ensureAdminUserAndRole(models, options = {}) {
  const { User, Role } = models;
  if (!User || !Role) {
    throw new Error('User and Role models are required to bind the admin role');
  }

  const [adminRole, createdRole] = await Role.findOrCreate({
    where: { code: 'admin' },
    defaults: {
      name: '系统管理员',
      description: '系统管理员角色，拥有所有权限',
      status: 'active',
      rank: 0
    }
  });

  let adminUser = await User.findOne({ where: { username: DEFAULT_ADMIN.username } });
  let createdUser = false;

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(options.password || DEFAULT_ADMIN.password, 10);
    adminUser = await User.create({
      username: DEFAULT_ADMIN.username,
      email: DEFAULT_ADMIN.email,
      password: hashedPassword,
      name: DEFAULT_ADMIN.name,
      status: 'active'
    });
    createdUser = true;
  }

  const alreadyBound = await adminUser.hasRole(adminRole);
  let bound = false;
  if (!alreadyBound) {
    await adminUser.addRole(adminRole);
    bound = true;
  }

  return { adminUser, adminRole, createdUser, createdRole, bound };
}

async function createAdminUser() {
  try {
    const models = await getModels();
    const result = await ensureAdminUserAndRole(models);

    if (result.createdRole) {
      console.log('管理员角色创建成功');
    } else {
      console.log('管理员角色已存在');
    }

    if (result.createdUser) {
      console.log('管理员用户创建成功');
    } else {
      console.log('管理员用户已存在');
    }

    if (result.bound) {
      console.log('管理员用户已关联管理员角色');
    } else {
      console.log('管理员用户角色关联已存在');
    }
  } catch (error) {
    console.error('创建管理员用户失败:', error);
  }
}

module.exports = createAdminUser;
module.exports.ensureAdminUserAndRole = ensureAdminUserAndRole;
