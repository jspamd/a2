const jwt = require('jsonwebtoken');
const getModels = require('../models');

let models;

// 初始化模型
const initializeModels = async () => {
  try {
    models = await getModels();
  } catch (error) {
    console.error('初始化模型失败:', error);
    throw error;
  }
};

// 确保模型已初始化
const ensureModelsInitialized = async () => {
  if (!models) {
    await initializeModels();
  }
  return models;
};

/**
 * 验证Token中间件
 */
exports.verifyToken = (req, res, next) => {
  try {
    // 从请求头获取认证信息
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: '未提供访问令牌'
      });
    }
    
    // 提取token
    const token = authHeader.split(' ')[1];
    
    // 验证token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            status: 'error',
            message: '访问令牌已过期'
          });
        }
        return res.status(401).json({
          status: 'error',
          message: '无效的访问令牌'
        });
      }
      
      // 将解码后的用户信息保存到请求对象中
      req.user = decoded;
      req.userId = decoded.id;
      next();
    });
  } catch (error) {
    console.error('验证Token错误:', error);
    res.status(500).json({
      status: 'error',
      message: '服务器内部错误'
    });
  }
};

/**
 * 检查用户角色中间件
 * @param {string[]} roles - 允许访问的角色列表
 */
exports.checkRole = (roles) => {
  return async (req, res, next) => {
    try {
      // 直接从req.user中获取角色信息
      // JWT令牌中存储的是单个role而非roles数组
      const userRole = req.user.role;
      
      // 检查用户角色是否在允许列表中
      const hasRole = roles.includes(userRole);
      
      if (!hasRole) {
        return res.status(403).json({
          status: 'error',
          message: '权限不足，无法执行此操作'
        });
      }
      
      next();
    } catch (error) {
      console.error('检查角色错误:', error);
      res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  };
};

/**
 * 检查权限中间件
 * @param {string[]} permissions - 允许访问的权限列表
 */
exports.checkPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const { User, Role } = await ensureModelsInitialized();
      const userId = req.userId;
      
      // 获取用户角色及关联的权限
      const user = await User.findByPk(userId, {
        include: [{
          model: Role,
          as: 'roles',
          include: ['permissions']
        }]
      });
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: '用户不存在'
        });
      }
      
      // 检查用户是否拥有所需权限
      let hasPermission = false;
      
      for (const role of user.roles) {
        for (const rolePermission of role.permissions) {
          if (permissions.includes(rolePermission.code)) {
            hasPermission = true;
            break;
          }
        }
        if (hasPermission) break;
      }
      
      if (!hasPermission) {
        return res.status(403).json({
          status: 'error',
          message: '权限不足，无法执行此操作'
        });
      }
      
      next();
    } catch (error) {
      console.error('检查权限错误:', error);
      res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  };
}; 