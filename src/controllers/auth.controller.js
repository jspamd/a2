const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const getModels = require('../models');
const { logger } = require('../utils/logger');

let models;
let User, Role, Department;

// 初始化模型
const initializeModels = async () => {
  try {
    logger.info('正在初始化认证控制器模型...');
    models = await getModels();
    User = models.User;
    Role = models.Role;
    Department = models.Department;
    logger.info('认证控制器模型初始化完成');
  } catch (error) {
    logger.error('初始化认证控制器模型失败:', error);
    throw error;
  }
};

// 确保模型已初始化
const ensureModelsInitialized = async () => {
  if (!models) {
    await initializeModels();
  }
};

/**
 * 用户注册
 */
exports.register = async (req, res) => {
  try {
    await ensureModelsInitialized();
    const { username, email, password, fullName, department } = req.body;

    logger.info('开始用户注册流程:', { username, email });

    // 检查用户名或邮箱是否已存在
    const existingUser = await User.findOne({
      where: {
        [Sequelize.Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      logger.warn('用户名或邮箱已被使用:', { username, email });
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

    logger.info('用户注册成功:', { userId: newUser.id, username });

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
    logger.error('用户注册错误:', error);
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
  const { username, password } = req.body;
  logger.info('收到登录请求:', { username });

  try {
    logger.info('正在初始化模型...');
    await ensureModelsInitialized();
    logger.info('模型初始化完成');

    // 查找用户
    logger.info('正在查找用户...');
    const user = await User.findOne({ 
      where: { username },
      include: [{
        model: Role,
        as: 'role'
      }]
    });
    
    if (!user) {
      logger.warn('用户不存在:', username);
      return res.status(401).json({
        status: 'error',
        message: '用户名或密码错误'
      });
    }

    logger.info('找到用户:', {
      id: user.id,
      username: user.username,
      status: user.status,
      role: user.role ? user.role.code : null
    });

    // 检查用户状态
    logger.info('正在检查用户状态...');
    if (user.status !== 'active') {
      logger.warn('用户账号已禁用:', username);
      return res.status(401).json({
        status: 'error',
        message: '账号已被禁用'
      });
    }

    // 验证密码
    logger.info('正在验证密码...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      logger.warn('密码验证失败:', username);
      return res.status(401).json({
        status: 'error',
        message: '用户名或密码错误'
      });
    }

    logger.info('密码验证成功');

    // 检查JWT密钥是否存在
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      logger.error('JWT密钥未配置');
      return res.status(500).json({
        status: 'error',
        message: '服务器配置错误'
      });
    }

    // 生成令牌
    logger.info('正在生成访问令牌...');
    const accessToken = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        role: user.role ? user.role.code : null
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    // 生成刷新令牌
    logger.info('正在生成刷新令牌...');
    const refreshToken = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        role: user.role ? user.role.code : null
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // 更新最后登录时间
    logger.info('正在更新最后登录时间...');
    await user.update({ lastLoginAt: new Date() });

    logger.info('登录成功:', username);
    return res.json({
      status: 'success',
      message: '登录成功',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          status: user.status,
          role: user.role ? user.role.code : null,
          lastLoginAt: user.lastLoginAt
        }
      }
    });
  } catch (error) {
    logger.error('登录过程中发生错误:', error);
    return res.status(500).json({
      status: 'error',
      message: '服务器内部错误',
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