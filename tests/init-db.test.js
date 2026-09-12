const fs = require('fs');
const path = require('path');

const { parseForceFlag, initializeDatabase } = require('../init-db');

describe('init-db.js', () => {
  const originalArgv = process.argv;
  const originalForce = process.env.INIT_DB_FORCE;

  afterEach(() => {
    process.argv = originalArgv;
    if (originalForce === undefined) {
      delete process.env.INIT_DB_FORCE;
    } else {
      process.env.INIT_DB_FORCE = originalForce;
    }
  });

  test('src/models 导出的是异步工厂函数，而不是带 sequelize 的对象', () => {
    const modelsExport = require('../src/models');
    expect(typeof modelsExport).toBe('function');
    expect(modelsExport.sequelize).toBeUndefined();
  });

  test('脚本源码会 await 模型工厂，而不是同步读取 .sequelize', () => {
    const source = fs.readFileSync(path.join(__dirname, '../init-db.js'), 'utf8');
    expect(source).toMatch(/await loadModels\(\)/);
    expect(source).toMatch(/require\(['"]\.\/src\/models['"]\)\(\)/);
    expect(source).not.toMatch(/require\(['"]\.\/src\/models['"]\)\.sequelize/);
    expect(source).not.toMatch(/const db = require\(['"]\.\/src\/models['"]\);/);
  });

  test('parseForceFlag 默认关闭，避免误删数据', () => {
    expect(parseForceFlag([], {})).toBe(false);
    expect(parseForceFlag(['--help'], { INIT_DB_FORCE: 'false' })).toBe(false);
  });

  test('parseForceFlag 仅在显式参数或环境变量时开启', () => {
    expect(parseForceFlag(['--force'], {})).toBe(true);
    expect(parseForceFlag(['--reset'], {})).toBe(true);
    expect(parseForceFlag([], { INIT_DB_FORCE: 'true' })).toBe(true);
    expect(parseForceFlag([], { INIT_DB_FORCE: '1' })).toBe(true);
  });

  test('initializeDatabase 会 await 工厂并默认以 force:false 同步', async () => {
    const authenticate = jest.fn().mockResolvedValue();
    const sync = jest.fn().mockResolvedValue();
    const close = jest.fn().mockResolvedValue();
    const loadModels = jest.fn().mockResolvedValue({ sequelize: { authenticate, sync, close } });
    const ensureDatabase = jest.fn().mockResolvedValue();
    const seed = jest.fn().mockResolvedValue();

    await initializeDatabase({
      force: false,
      loadModels,
      ensureDatabase,
      seed,
      close: true
    });

    expect(ensureDatabase).toHaveBeenCalledWith({ dropFirst: false });
    expect(loadModels).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith({ force: false });
    expect(seed).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('force 模式才会 drop 数据库并以 force:true 同步', async () => {
    const authenticate = jest.fn().mockResolvedValue();
    const sync = jest.fn().mockResolvedValue();
    const close = jest.fn().mockResolvedValue();
    const loadModels = jest.fn().mockResolvedValue({ sequelize: { authenticate, sync, close } });
    const ensureDatabase = jest.fn().mockResolvedValue();

    await initializeDatabase({
      force: true,
      loadModels,
      ensureDatabase,
      seed: async () => {},
      close: true
    });

    expect(ensureDatabase).toHaveBeenCalledWith({ dropFirst: true });
    expect(sync).toHaveBeenCalledWith({ force: true });
  });

  test('工厂未返回 sequelize 时抛出明确错误，而不是读取 undefined.authenticate', async () => {
    await expect(
      initializeDatabase({
        force: false,
        loadModels: async () => ({}),
        ensureDatabase: async () => {},
        seed: async () => {}
      })
    ).rejects.toThrow(/异步工厂/);
  });

  test('默认 seed 走 initializeSystemData，角色绑定复用 ensureAdminUserAndRole', () => {
    const source = fs.readFileSync(path.join(__dirname, '../init-db.js'), 'utf8');
    expect(source).toMatch(/initializeSystemData/);
    expect(source).toMatch(/ensureAdminUserAndRole/);
    expect(source).not.toMatch(/function linkAdminRole/);
  });
});
