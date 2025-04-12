const { Sequelize } = require('sequelize');
const workflowModel = require('../src/models/workflow.model');
const userModel = require('../src/models/user.model');

describe('工作流模型测试', () => {
  let sequelize;
  let models;

  beforeAll(async () => {
    try {
      // 创建内存数据库连接
      sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false
      });
      console.log('数据库连接创建成功');

      // 初始化所有模型
      const workflowModels = workflowModel(sequelize);
      const { User } = userModel(sequelize);
      
      models = {
        ...workflowModels,
        User
      };
      console.log('模型初始化成功');

      // 设置关联
      Object.values(models).forEach(model => {
        if (typeof model.associate === 'function') {
          model.associate(models);
        }
      });
      console.log('关联设置成功');

      // 同步数据库
      await sequelize.sync({ force: true });
      console.log('数据库同步成功');
    } catch (error) {
      console.error('初始化失败:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await sequelize.close();
      console.log('数据库连接已关闭');
    } catch (error) {
      console.error('关闭数据库连接失败:', error);
      throw error;
    }
  });

  test('工作流定义可以创建实例', async () => {
    try {
      // 创建测试用户
      console.log('开始创建测试用户...');
      const user = await models.User.create({
        username: 'testuser',
        name: 'Test User',
        password: 'password123',
        email: 'test@example.com',
        status: 'active'
      });
      console.log('测试用户创建成功:', user.id);

      console.log('开始创建工作流定义...');
      // 创建工作流定义
      const definition = await models.WorkflowDefinition.create({
        name: '测试工作流',
        code: 'TEST_WORKFLOW',
        category: '测试类别',
        description: '用于测试的工作流',
        nodeConfig: {
          nodes: [
            {
              id: 'start',
              type: 'start',
              name: '开始'
            },
            {
              id: 'end',
              type: 'end',
              name: '结束'
            }
          ]
        }
      });
      console.log('工作流定义创建成功:', definition.id);

      console.log('开始创建工作流实例...');
      // 创建工作流实例
      const instance = await models.WorkflowInstance.create({
        workflowDefinitionId: definition.id,
        title: '测试工作流实例',
        formData: {},
        currentNode: 'start',
        status: 'draft',
        initiatorId: user.id
      });
      console.log('工作流实例创建成功:', instance.id);

      console.log('开始验证关联...');
      // 验证关联
      const definitionWithInstances = await models.WorkflowDefinition.findOne({
        where: { id: definition.id },
        include: ['definitionInstances']
      });
      console.log('关联验证完成');

      expect(definitionWithInstances).toBeTruthy();
      expect(definitionWithInstances.definitionInstances).toHaveLength(1);
      expect(definitionWithInstances.definitionInstances[0].id).toBe(instance.id);
    } catch (error) {
      console.error('测试失败:', error);
      throw error;
    }
  });
}); 