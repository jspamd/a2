const { body, param, query, validationResult } = require('express-validator');

/**
 * 验证结果处理中间件
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: '数据验证失败',
      errors: errors.array()
    });
  }
  next();
};

/**
 * 用户相关验证规则
 */
const userValidators = {
  create: [
    body('username')
      .notEmpty().withMessage('用户名不能为空')
      .isLength({ min: 3, max: 50 }).withMessage('用户名长度应在3-50个字符之间')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名只能包含字母、数字和下划线'),
    
    body('password')
      .notEmpty().withMessage('密码不能为空')
      .isLength({ min: 6 }).withMessage('密码长度不能少于6个字符'),
    
    body('name')
      .notEmpty().withMessage('姓名不能为空')
      .isLength({ max: 50 }).withMessage('姓名长度不能超过50个字符'),
    
    body('email')
      .notEmpty().withMessage('邮箱不能为空')
      .isEmail().withMessage('邮箱格式不正确'),
    
    body('phone')
      .optional()
      .isMobilePhone('zh-CN').withMessage('手机号码格式不正确'),
    
    body('departmentId')
      .optional()
      .isInt().withMessage('部门ID必须是整数'),
    
    body('roleIds')
      .optional()
      .isArray().withMessage('角色ID必须是数组'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'locked']).withMessage('状态值无效')
  ],
  
  update: [
    param('id')
      .isInt().withMessage('用户ID必须是整数'),
    
    body('name')
      .optional()
      .isLength({ max: 50 }).withMessage('姓名长度不能超过50个字符'),
    
    body('email')
      .optional()
      .isEmail().withMessage('邮箱格式不正确'),
    
    body('phone')
      .optional()
      .isMobilePhone('zh-CN').withMessage('手机号码格式不正确'),
    
    body('departmentId')
      .optional()
      .isInt().withMessage('部门ID必须是整数'),
    
    body('roleIds')
      .optional()
      .isArray().withMessage('角色ID必须是数组'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'locked']).withMessage('状态值无效')
  ],
  
  resetPassword: [
    param('id')
      .isInt().withMessage('用户ID必须是整数'),
    
    body('newPassword')
      .notEmpty().withMessage('新密码不能为空')
      .isLength({ min: 6 }).withMessage('新密码长度不能少于6个字符')
  ]
};

/**
 * 角色相关验证规则
 */
const roleValidators = {
  create: [
    body('name')
      .notEmpty().withMessage('角色名称不能为空')
      .isLength({ max: 50 }).withMessage('角色名称长度不能超过50个字符'),
    
    body('code')
      .notEmpty().withMessage('角色编码不能为空')
      .isLength({ max: 50 }).withMessage('角色编码长度不能超过50个字符')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('角色编码只能包含字母、数字和下划线'),
    
    body('description')
      .optional()
      .isLength({ max: 255 }).withMessage('描述长度不能超过255个字符'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('状态值无效'),
    
    body('rank')
      .optional()
      .isInt().withMessage('等级必须是整数')
  ],
  
  update: [
    param('id')
      .isInt().withMessage('角色ID必须是整数'),
    
    body('name')
      .optional()
      .isLength({ max: 50 }).withMessage('角色名称长度不能超过50个字符'),
    
    body('description')
      .optional()
      .isLength({ max: 255 }).withMessage('描述长度不能超过255个字符'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('状态值无效'),
    
    body('rank')
      .optional()
      .isInt().withMessage('等级必须是整数')
  ]
};

/**
 * 部门相关验证规则
 */
const departmentValidators = {
  create: [
    body('name')
      .notEmpty().withMessage('部门名称不能为空')
      .isLength({ max: 100 }).withMessage('部门名称长度不能超过100个字符'),
    
    body('code')
      .notEmpty().withMessage('部门编码不能为空')
      .isLength({ max: 50 }).withMessage('部门编码长度不能超过50个字符')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('部门编码只能包含字母、数字和下划线'),
    
    body('description')
      .optional()
      .isLength({ max: 255 }).withMessage('描述长度不能超过255个字符'),
    
    body('parentId')
      .optional()
      .isInt().withMessage('父部门ID必须是整数'),
    
    body('managerId')
      .optional()
      .isInt().withMessage('管理者ID必须是整数'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('状态值无效')
  ],
  
  update: [
    param('id')
      .isInt().withMessage('部门ID必须是整数'),
    
    body('name')
      .optional()
      .isLength({ max: 100 }).withMessage('部门名称长度不能超过100个字符'),
    
    body('description')
      .optional()
      .isLength({ max: 255 }).withMessage('描述长度不能超过255个字符'),
    
    body('parentId')
      .optional()
      .isInt().withMessage('父部门ID必须是整数'),
    
    body('managerId')
      .optional()
      .isInt().withMessage('管理者ID必须是整数'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('状态值无效')
  ]
};

/**
 * 认证相关验证规则
 */
const authValidators = {
  register: [
    body('username')
      .notEmpty().withMessage('用户名不能为空')
      .isLength({ min: 3, max: 50 }).withMessage('用户名长度应在3-50个字符之间')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名只能包含字母、数字和下划线'),
    
    body('password')
      .notEmpty().withMessage('密码不能为空')
      .isLength({ min: 6 }).withMessage('密码长度不能少于6个字符'),
    
    body('email')
      .notEmpty().withMessage('邮箱不能为空')
      .isEmail().withMessage('邮箱格式不正确'),
    
    body('fullName')
      .notEmpty().withMessage('姓名不能为空')
      .isLength({ max: 50 }).withMessage('姓名长度不能超过50个字符')
  ],
  
  login: [
    body('username')
      .notEmpty().withMessage('用户名不能为空'),
    
    body('password')
      .notEmpty().withMessage('密码不能为空')
  ],
  
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('当前密码不能为空'),
    
    body('newPassword')
      .notEmpty().withMessage('新密码不能为空')
      .isLength({ min: 6 }).withMessage('新密码长度不能少于6个字符')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('新密码不能与当前密码相同');
        }
        return true;
      })
  ],
  
  refreshToken: [
    body('refreshToken')
      .notEmpty().withMessage('刷新令牌不能为空')
  ]
};

module.exports = {
  validate,
  userValidators,
  roleValidators,
  departmentValidators,
  authValidators
}; 