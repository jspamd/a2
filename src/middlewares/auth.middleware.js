const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * JWT认证中间件
 */
exports.authenticate = async (req, res, next) => {
  try {
    // 从请求头获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: '未提供认证令牌'
      });
    }

    // 提取令牌
    const token = authHeader.split(' ')[1];

    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 检查用户是否存在
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '认证失败：用户不存在'
      });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: '账户已被禁用，请联系管理员'
      });
    }

    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: '认证令牌已过期'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: '无效的认证令牌'
      });
    }
    console.error('认证中间件错误:', error);
    res.status(500).json({
      status: 'error',
      message: '认证过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 角色验证中间件
 * @param {...string} roles - 允许访问的角色代码
 */
exports.hasRole = (...roles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      // 查询用户及其角色
      const user = await User.findByPk(userId, {
        include: [{ model: Role, as: 'role' }]
      });

      if (!user || !user.role) {
        return res.status(403).json({
          status: 'error',
          message: '权限不足：未分配角色'
        });
      }

      // 检查用户角色是否在允许的角色列表中
      if (!roles.includes(user.role.code)) {
        return res.status(403).json({
          status: 'error',
          message: '权限不足：角色不允许访问'
        });
      }

      next();
    } catch (error) {
      console.error('角色验证错误:', error);
      res.status(500).json({
        status: 'error',
        message: '角色验证过程中发生错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * 权限验证中间件
 * @param {...string} permissions - 允许访问的权限代码
 */
exports.hasPermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      // 查询用户角色及其权限
      const user = await User.findByPk(userId, {
        include: [
          { 
            model: Role, 
            as: 'role',
            include: [
              {
                model: Permission,
                as: 'permissions'
              }
            ]
          }
        ]
      });

      if (!user || !user.role || !user.role.permissions) {
        return res.status(403).json({
          status: 'error',
          message: '权限不足：未分配权限'
        });
      }

      // 提取用户拥有的权限代码
      const userPermissions = user.role.permissions.map(permission => permission.code);

      // 检查用户是否拥有所需的权限
      const hasRequiredPermission = permissions.some(permission => userPermissions.includes(permission));
      
      if (!hasRequiredPermission) {
        return res.status(403).json({
          status: 'error',
          message: '权限不足：缺少所需权限'
        });
      }

      next();
    } catch (error) {
      console.error('权限验证错误:', error);
      res.status(500).json({
        status: 'error',
        message: '权限验证过程中发生错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

// 验证令牌
exports.verifyToken = (req, res, next) => {
  const token = req.headers['x-access-token'] || req.headers['authorization'];
  
  if (!token) {
    return res.status(403).json({
      status: 'error',
      message: '未提供访问令牌'
    });
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: '无效的访问令牌'
    });
  }
};

// 验证管理员权限
exports.isAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '需要管理员权限'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: '验证管理员权限失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 验证部门经理权限
exports.isDepartmentManager = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }
    
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '需要部门经理权限'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: '验证部门经理权限失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

