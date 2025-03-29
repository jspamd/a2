const bcrypt = require('bcrypt');
const { User, Role, Department } = require('../models');
const { Sequelize, Op } = require('sequelize');

/**
 * 获取所有用户
 */
exports.getAllUsers = async (req, res) => {
  try {
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 搜索参数
    const search = req.query.search || '';
    const departmentId = req.query.departmentId;
    const status = req.query.status;
    
    // 构建查询条件
    const whereCondition = {};
    
    if (search) {
      whereCondition[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (departmentId) {
      whereCondition.departmentId = departmentId;
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    // 执行查询，包括关联数据
    const { count, rows } = await User.findAndCountAll({
      where: whereCondition,
      include: [
        { model: Department, as: 'department' },
        { model: Role }
      ],
      attributes: { exclude: ['password'] },
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取用户列表成功',
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取用户列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 根据ID获取用户
 */
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findByPk(userId, {
      include: [
        { model: Department, as: 'department' },
        { model: Role }
      ],
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: '获取用户成功',
      data: user
    });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取用户详情失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 创建用户
 */
exports.createUser = async (req, res) => {
  try {
    const { 
      username, 
      password, 
      name, 
      email, 
      phone, 
      position, 
      departmentId,
      roleIds,
      status
    } = req.body;
    
    // 验证必填字段
    if (!username || !password || !name || !email) {
      return res.status(400).json({
        status: 'error',
        message: '用户名、密码、姓名和邮箱为必填项'
      });
    }
    
    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: '用户名或邮箱已被使用'
      });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建用户
    const newUser = await User.create({
      username,
      password: hashedPassword,
      name,
      email,
      phone,
      position,
      departmentId,
      status: status || 'active'
    });
    
    // 如果提供了角色IDs，添加角色关联
    if (roleIds && roleIds.length > 0) {
      const roles = await Role.findAll({
        where: {
          id: {
            [Op.in]: roleIds
          }
        }
      });
      
      await newUser.setRoles(roles);
    }
    
    // 返回新创建的用户（不含密码）
    const userData = await User.findByPk(newUser.id, {
      include: [
        { model: Department, as: 'department' },
        { model: Role }
      ],
      attributes: { exclude: ['password'] }
    });
    
    res.status(201).json({
      status: 'success',
      message: '用户创建成功',
      data: userData
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({
      status: 'error',
      message: '创建用户失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 更新用户
 */
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { 
      name, 
      email, 
      phone, 
      position, 
      departmentId,
      roleIds,
      status,
      avatar
    } = req.body;
    
    // 查找用户
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    // 检查当前用户是否有权限
    // 普通用户只能修改自己的信息，管理员可以修改任何用户
    if (req.user.id !== parseInt(userId) && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        status: 'error',
        message: '无权修改此用户信息'
      });
    }
    
    // 检查邮箱是否被其他用户使用
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: {
          email,
          id: { [Op.ne]: userId }
        }
      });
      
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: '邮箱已被其他用户使用'
        });
      }
    }
    
    // 更新用户基本信息
    await user.update({
      name: name || user.name,
      email: email || user.email,
      phone: phone || user.phone,
      position: position || user.position,
      departmentId: departmentId || user.departmentId,
      status: status || user.status,
      avatar: avatar || user.avatar
    });
    
    // 如果提供了角色IDs，更新角色关联
    if (roleIds && Array.isArray(roleIds)) {
      const roles = await Role.findAll({
        where: {
          id: {
            [Op.in]: roleIds
          }
        }
      });
      
      await user.setRoles(roles);
    }
    
    // 获取更新后的用户数据（包含关联数据）
    const updatedUser = await User.findByPk(userId, {
      include: [
        { model: Department, as: 'department' },
        { model: Role }
      ],
      attributes: { exclude: ['password'] }
    });
    
    res.status(200).json({
      status: 'success',
      message: '用户更新成功',
      data: updatedUser
    });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({
      status: 'error',
      message: '更新用户失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 删除用户
 */
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 查找用户
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    // 检查是否是管理员（防止删除最后一个管理员）
    const isAdmin = await user.getRoles({
      where: { code: 'admin' }
    });
    
    if (isAdmin.length > 0) {
      // 查找其他管理员
      const otherAdmins = await User.findAll({
        include: [{
          model: Role,
          where: { code: 'admin' }
        }],
        where: {
          id: { [Op.ne]: userId }
        }
      });
      
      if (otherAdmins.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: '不能删除系统中唯一的管理员用户'
        });
      }
    }
    
    // 软删除用户
    await user.destroy();
    
    res.status(200).json({
      status: 'success',
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({
      status: 'error',
      message: '删除用户失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取用户角色
 */
exports.getUserRoles = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 查找用户
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    // 获取用户角色
    const roles = await user.getRoles();
    
    res.status(200).json({
      status: 'success',
      message: '获取用户角色成功',
      data: roles
    });
  } catch (error) {
    console.error('获取用户角色错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取用户角色失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 更新用户角色
 */
exports.updateUserRoles = async (req, res) => {
  try {
    const userId = req.params.id;
    const { roleIds } = req.body;
    
    if (!Array.isArray(roleIds)) {
      return res.status(400).json({
        status: 'error',
        message: 'roleIds必须是一个数组'
      });
    }
    
    // 查找用户
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    // 查找角色
    const roles = await Role.findAll({
      where: {
        id: {
          [Op.in]: roleIds
        }
      }
    });
    
    if (roles.length === 0 && roleIds.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: '未找到有效的角色'
      });
    }
    
    // 更新用户角色
    await user.setRoles(roles);
    
    // 获取更新后的角色
    const updatedRoles = await user.getRoles();
    
    res.status(200).json({
      status: 'success',
      message: '用户角色更新成功',
      data: updatedRoles
    });
  } catch (error) {
    console.error('更新用户角色错误:', error);
    res.status(500).json({
      status: 'error',
      message: '更新用户角色失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 重置用户密码
 */
exports.resetPassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: '新密码不能为空且长度不能少于6个字符'
      });
    }
    
    // 查找用户
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    await user.update({
      password: hashedPassword
    });
    
    res.status(200).json({
      status: 'success',
      message: '密码重置成功'
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({
      status: 'error',
      message: '重置密码失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 