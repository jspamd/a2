const { Sequelize } = require('sequelize');
const jwt = require('jsonwebtoken');
const userModel = require('../src/models/user.model');
const roleModel = require('../src/models/role.model');
const departmentModel = require('../src/models/department.model');
const permissionModel = require('../src/models/permission.model');
const { ensureAdminUserAndRole } = require('../src/seeders/admin-user');

function loginRoleFromUser(user) {
  return user.roles && user.roles.length > 0 ? user.roles[0].code : null;
}

function signLoginToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: loginRoleFromUser(user) },
    'test-jwt-secret',
    { expiresIn: '1d' }
  );
}

/**
 * Load only the models the admin bind needs. Avoid src/models/index.js
 * (MySQL) and the broken Department-less workflow suite.
 */
async function createMemoryDb() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  });

  const { User } = userModel(sequelize);
  const { Role } = roleModel(sequelize);
  const { Department } = departmentModel(sequelize, Sequelize.DataTypes);
  const { Permission } = permissionModel(sequelize, Sequelize.DataTypes);

  const models = { User, Role, Department, Permission };
  Object.values(models).forEach((model) => {
    if (typeof model.associate === 'function') {
      model.associate(models);
    }
  });

  await sequelize.sync({ force: true });
  return { sequelize, models };
}

async function loadAdminWithRoles(User, Role) {
  return User.findOne({
    where: { username: 'admin' },
    include: [{ model: Role, as: 'roles' }]
  });
}

describe('ensureAdminUserAndRole', () => {
  let sequelize;
  let models;

  beforeEach(async () => {
    ({ sequelize, models } = await createMemoryDb());
  });

  afterEach(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  test('fresh seed links admin user to admin role (JWT role source)', async () => {
    const { User, Role } = models;
    const result = await ensureAdminUserAndRole(models);

    expect(result.createdUser).toBe(true);
    expect(result.createdRole).toBe(true);
    expect(result.bound).toBe(true);

    const admin = await loadAdminWithRoles(User, Role);
    expect(admin).not.toBeNull();
    expect(admin.roles).toHaveLength(1);
    expect(admin.roles[0].code).toBe('admin');

    const decoded = jwt.verify(signLoginToken(admin), 'test-jwt-secret');
    expect(decoded.role).toBe('admin');
    expect(decoded.username).toBe('admin');
  });

  test('is idempotent on re-seed and does not duplicate UserRoles', async () => {
    const { User, Role } = models;

    await ensureAdminUserAndRole(models);
    const second = await ensureAdminUserAndRole(models);

    expect(second.createdUser).toBe(false);
    expect(second.createdRole).toBe(false);
    expect(second.bound).toBe(false);

    const admin = await loadAdminWithRoles(User, Role);
    expect(admin.roles.map((role) => role.code)).toEqual(['admin']);

    const [joinRows] = await sequelize.query(
      'SELECT userId, roleId FROM UserRoles'
    );
    expect(joinRows).toHaveLength(1);
    expect(Number(joinRows[0].userId)).toBe(admin.id);
    expect(Number(joinRows[0].roleId)).toBe(admin.roles[0].id);
  });

  test('repairs an existing user+role that were never linked', async () => {
    const { User, Role } = models;

    const role = await Role.create({
      name: '系统管理员',
      code: 'admin',
      description: '系统管理员角色，拥有所有权限',
      status: 'active',
      rank: 0
    });
    const user = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: 'already-hashed',
      name: 'System Administrator',
      status: 'active'
    });

    const before = await loadAdminWithRoles(User, Role);
    expect(before.roles).toHaveLength(0);
    expect(jwt.verify(signLoginToken(before), 'test-jwt-secret').role).toBeNull();

    const result = await ensureAdminUserAndRole(models);

    expect(result.createdUser).toBe(false);
    expect(result.createdRole).toBe(false);
    expect(result.bound).toBe(true);
    expect(result.adminUser.id).toBe(user.id);
    expect(result.adminRole.id).toBe(role.id);
    expect(result.adminUser.password).toBe('already-hashed');

    const after = await loadAdminWithRoles(User, Role);
    expect(after.roles.map((r) => r.code)).toEqual(['admin']);
    expect(jwt.verify(signLoginToken(after), 'test-jwt-secret').role).toBe('admin');
  });
});
