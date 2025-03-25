const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const { User, Role } = require('../models');
const { Department } = require('../models');

/**
 * 用户注册
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName, department } = req.body;

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
      role: 'user', // 默认角色
      status: 'active'
    });

    // 返回响应，不包含密码
    res.status(201).json({
      status: 'success',
      message: '用户注册成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        department: newUser.department,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('用户注册错误:', error);
    res.status(500).json({
      status: 'error',
      message: '用户注册过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 用户登录
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({
      where: {
        [Sequelize.Op.or]: [
          { username },
          { email: username } // 允许使用邮箱登录
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '用户名或密码不正确'
      });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: '账户已被禁用，请联系管理员'
      });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: '用户名或密码不正确'
      });
    }

    // 生成访问令牌
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 生成刷新令牌
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // 更新用户最后登录时间
    await user.update({
      lastLogin: new Date()
    });

    res.status(200).json({
      status: 'success',
      message: '登录成功',
      data: {
        accessToken: token,
        refreshToken: refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          department: user.department
        }
      }
    });
  } catch (error) {
    console.error('用户登录错误:', error);
    res.status(500).json({
      status: 'error',
      message: '登录过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取当前用户信息
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

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
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取用户信息过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 修改密码
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    // 查找用户
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: '当前密码不正确'
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
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      status: 'error',
      message: '修改密码过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 刷新令牌
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // 验证刷新令牌
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // 查找用户
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: '账户已被禁用，请联系管理员'
      });
    }

    // 生成新的访问令牌
    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: '刷新令牌已过期，请重新登录'
      });
    }
    console.error('刷新令牌错误:', error);
    res.status(500).json({
      status: 'error',
      message: '刷新令牌过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 用户登出
 */
exports.logout = (req, res) => {
  // 客户端应该删除存储的令牌
  res.status(200).json({
    status: 'success',
    message: '登出成功'
  });
};