const bcrypt = require('bcrypt');
const getModels = require('../models');

   async function createAdminUser() {
     try {
       const models = await getModels();
       const { User, Role } = models;

       // 使用 upsert 创建或更新管理员角色
       const [adminRole, created] = await Role.upsert({
         name: '系统管理员',
         code: 'admin',
         description: '系统管理员角色，拥有所有权限',
         status: 'active',
         rank: 0
       }, {
         returning: true
       });

       if (created) {
         console.log('管理员角色创建成功');
       } else {
         console.log('管理员角色已存在，已更新');
       }

       // 使用 upsert 创建或更新管理员用户
       const hashedPassword = await bcrypt.hash('admin123', 10);
       const [adminUser, userCreated] = await User.upsert({
         username: 'admin',
         email: 'admin@example.com',
         password: hashedPassword,
         name: 'System Administrator',
         roleId: adminRole.id,
         status: 'active',
         createdAt: new Date(),
         updatedAt: new Date()
       }, {
         returning: true
       });

       if (userCreated) {
         console.log('管理员用户创建成功');
       } else {
         console.log('管理员用户已存在，已更新');
       }
     } catch (error) {
       console.error('创建管理员用户失败:', error);
     }
   }


module.exports = createAdminUser; 