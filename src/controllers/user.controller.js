const bcrypt = require('bcrypt');
const { User } = require('../models');
const { Sequelize } = require('sequelize');

/**
 * 获取所有用户
 */
exports.getAllUsers = async (req, res) => {
  try {
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 查询参数
    const { search, department, role, status } = req.query;

    // 构建查询条件
    const whereCondition = {};
    
    if (search) {
      whereCondition[Sequelize.Op.or] = [
        { username: { [Sequelize.Op.like]: `%${search}%` } },
        { fullName: { [Sequelize.Op.like]: `%${search}%` } },
        { email: { [Sequelize.Op.like]: `%${search}%` } }
      ];
    }
    
    if (department) {
      whereCondition.department = department;
    }
    
    if (role) {
      whereCondition.role = role;
    }
    
    if (status) {
      whereCondition.status = status;
    }

    // 查询用户列表，不包含密码字段
    const { count, rows } = await User.findAndCountAll({
      where: whereCondition,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    // 计算总页数
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: 'success',
      data: {
        users: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取用户列表过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取单个用户
 */
exports.getUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // 查询用户
    const user = await User.findByPk(userId, {
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
      data: user
    });
  } catch (error) {
    console.error('获取用户错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取用户信息过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 创建用户
 */
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, fullName, department, role, status } = req.body;

    // 检查用户名或邮箱是否已存在
    const existingUser = await User.findOne({
      where: {
        [Sequelize.Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: '用户名或邮箱已被使用'
      });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建新用户
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName,
      department,
      role: role || 'user',
      status: status || 'active'
    });

    // 返回响应，不包含密码
    res.status(201).json({
      status: 'success',
      message: '用户创建成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        department: newUser.department,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({
      status: 'error',
      message: '创建用户过程中发生错误',
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
    const { fullName, department, email, role, status } = req.body;

    // 查询用户
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }

    // 验证操作权限（普通用户只能修改自己的信息，管理员可以修改任何人）
    if (req.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '权限不足，无法修改其他用户信息'
      });
    }

    // 更新用户数据
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (department) updateData.department = department;
    if (email) updateData.email = email;
    
    // 仅管理员可以修改角色和状态
    if (req.user.role === 'admin') {
      if (role) updateData.role = role;
      if (status) updateData.status = status;
    }

    await user.update(updateData);

    res.status(200).json({
      status: 'success',
      message: '用户信息更新成功',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({
      status: 'error',
      message: '更新用户信息过程中发生错误',
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

    // 查询用户
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }

    // 执行删除操作 (软删除或硬删除)
    await user.destroy();

    res.status(200).json({
      status: 'success',
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({
      status: 'error',
      message: '删除用户过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 