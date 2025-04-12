// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const dotenv = require('dotenv');
dotenv.config();

const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');

async function fixAdminRole() {
  try {
    console.log('开始修复admin用户角色...');
    
    // 导入数据库配置
    const dbConfig = require('./src/config/database');
    
    // 创建Sequelize实例
    const sequelize = new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: 'mysql',
        logging: false
      }
    );
    
    // 测试连接
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 直接执行SQL查询修复
    console.log('查找admin用户...');
    const [users] = await sequelize.query("SELECT * FROM Users WHERE username = 'admin'");
    
    if (users.length === 0) {
      console.log('找不到admin用户，正在创建...');
      
      // 创建admin用户
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await sequelize.query(`
        INSERT INTO Users (username, password, name, email, status, createdAt, updatedAt)
        VALUES ('admin', '${hashedPassword}', 'System Administrator', 'admin@example.com', 'active', NOW(), NOW())
      `);
      
      console.log('admin用户创建成功');
    } else {
      console.log('找到admin用户，ID:', users[0].id);
      // 移除role字段更新，因为该字段不存在
    }
    
    // 查找admin角色
    console.log('查找admin角色...');
    const [roles] = await sequelize.query("SELECT * FROM Roles WHERE code = 'admin'");
    
    if (roles.length === 0) {
      console.log('找不到admin角色，正在创建...');
      
      // 创建admin角色
      await sequelize.query(`
        INSERT INTO Roles (name, code, description, status, rank, createdAt, updatedAt)
        VALUES ('系统管理员', 'admin', '系统管理员角色，拥有所有权限', 'active', 0, NOW(), NOW())
      `);
      
      console.log('admin角色创建成功');
      
      // 重新查询获取ID
      const [newRoles] = await sequelize.query("SELECT * FROM Roles WHERE code = 'admin'");
      if (newRoles.length > 0) {
        roles.push(newRoles[0]);
      }
    } else {
      console.log('找到admin角色，ID:', roles[0].id);
    }
    
    // 再次查询admin用户（以防刚创建）
    const [updatedUsers] = await sequelize.query("SELECT * FROM Users WHERE username = 'admin'");
    
    if (updatedUsers.length > 0 && roles.length > 0) {
      // 创建UserRoles关联
      console.log('正在关联admin用户和admin角色...');
      
      // 检查关联是否已存在
      const [userRoles] = await sequelize.query(`
        SELECT * FROM UserRoles 
        WHERE userId = ${updatedUsers[0].id} AND roleId = ${roles[0].id}
      `);
      
      if (userRoles.length === 0) {
        await sequelize.query(`
          INSERT INTO UserRoles (userId, roleId, createdAt, updatedAt)
          VALUES (${updatedUsers[0].id}, ${roles[0].id}, NOW(), NOW())
        `);
        console.log('用户-角色关联创建成功');
      } else {
        console.log('用户-角色关联已存在');
      }
    }
    
    console.log('admin用户角色修复完成!');
    
  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    process.exit(0);
  }
}

// 执行修复
fixAdminRole(); 