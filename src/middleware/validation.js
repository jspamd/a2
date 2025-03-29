const { body, param, query, validationResult } = require('express-validator');

// 处理验证结果的中间件
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: '请求数据验证失败',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// 用户验证规则
exports.userValidationRules = {
  create: [
    body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度应在3-50个字符之间')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('用户名只能包含字母、数字、下划线和连字符'),
    body('email').isEmail().withMessage('请提供有效的邮箱地址'),
    body('password').isLength({ min: 6 }).withMessage('密码长度至少为6个字符'),
    body('name').notEmpty().withMessage('姓名不能为空'),
    body('phone').optional().isMobilePhone('zh-CN').withMessage('请提供有效的手机号码'),
    body('departmentId').optional().isInt().withMessage('部门ID必须为整数')
  ],
  update: [
    body('name').optional().notEmpty().withMessage('姓名不能为空'),
    body('email').optional().isEmail().withMessage('请提供有效的邮箱地址'),
    body('phone').optional().isMobilePhone('zh-CN').withMessage('请提供有效的手机号码'),
    body('status').optional().isIn(['active', 'inactive', 'locked']).withMessage('状态值无效'),
    body('departmentId').optional().isInt().withMessage('部门ID必须为整数')
  ],
  resetPassword: [
    body('newPassword').isLength({ min: 6 }).withMessage('新密码长度至少为6个字符')
  ]
};

// 角色验证规则
exports.roleValidationRules = {
  create: [
    body('name').notEmpty().withMessage('角色名称不能为空'),
    body('code').notEmpty().withMessage('角色编码不能为空')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('角色编码只能包含字母、数字、下划线和连字符'),
    body('description').optional()
  ],
  update: [
    body('name').optional().notEmpty().withMessage('角色名称不能为空'),
    body('description').optional(),
    body('status').optional().isIn(['active', 'inactive']).withMessage('状态值无效')
  ]
};

// 部门验证规则
exports.departmentValidationRules = {
  create: [
    body('name').notEmpty().withMessage('部门名称不能为空'),
    body('code').notEmpty().withMessage('部门编码不能为空')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('部门编码只能包含字母、数字、下划线和连字符'),
    body('parentId').optional().isInt().withMessage('父部门ID必须为整数'),
    body('managerId').optional().isInt().withMessage('部门经理ID必须为整数'),
    body('description').optional()
  ],
  update: [
    body('name').optional().notEmpty().withMessage('部门名称不能为空'),
    body('description').optional(),
    body('status').optional().isIn(['active', 'inactive']).withMessage('状态值无效'),
    body('parentId').optional().isInt().withMessage('父部门ID必须为整数'),
    body('managerId').optional().isInt().withMessage('部门经理ID必须为整数')
  ]
};

// 工作流验证规则
exports.workflowValidationRules = {
  create: [
    body('name').notEmpty().withMessage('工作流名称不能为空'),
    body('description').optional(),
    body('nodes').isArray().withMessage('节点必须是数组'),
    body('nodes.*.name').notEmpty().withMessage('节点名称不能为空'),
    body('nodes.*.type').isIn(['approval', 'notification']).withMessage('节点类型无效'),
    body('nodes.*.approverRoles').optional().isArray().withMessage('审批角色必须是数组'),
    body('nodes.*.approverUsers').optional().isArray().withMessage('审批用户必须是数组')
  ],
  update: [
    body('name').optional().notEmpty().withMessage('工作流名称不能为空'),
    body('description').optional(),
    body('status').optional().isIn(['active', 'inactive']).withMessage('状态值无效')
  ],
  submit: [
    body('title').notEmpty().withMessage('标题不能为空'),
    body('content').optional(),
    body('attachments').optional().isArray().withMessage('附件必须是数组')
  ]
};

// 文档验证规则
exports.documentValidationRules = {
  upload: [
    body('title').notEmpty().withMessage('文档标题不能为空'),
    body('description').optional(),
    body('categoryId').optional().isInt().withMessage('分类ID必须为整数'),
    body('tags').optional()
  ],
  update: [
    body('title').optional().notEmpty().withMessage('文档标题不能为空'),
    body('description').optional(),
    body('categoryId').optional().isInt().withMessage('分类ID必须为整数'),
    body('tags').optional(),
    body('status').optional().isIn(['active', 'archived', 'deleted']).withMessage('状态值无效')
  ]
};

// 考勤验证规则
exports.attendanceValidationRules = {
  checkIn: [
    body('latitude').optional().isFloat().withMessage('纬度必须是有效的数字'),
    body('longitude').optional().isFloat().withMessage('经度必须是有效的数字'),
    body('location').optional(),
    body('comment').optional()
  ],
  leave: [
    body('startDate').isISO8601().withMessage('开始日期格式无效'),
    body('endDate').isISO8601().withMessage('结束日期格式无效'),
    body('leaveType').isIn(['annual', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'other']).withMessage('请假类型无效'),
    body('reason').notEmpty().withMessage('请假原因不能为空')
  ]
};

// 公告验证规则
exports.announcementValidationRules = {
  create: [
    body('title').notEmpty().withMessage('公告标题不能为空'),
    body('content').notEmpty().withMessage('公告内容不能为空'),
    body('importance').optional().isIn(['normal', 'important', 'urgent']).withMessage('重要程度值无效'),
    body('targetType').optional().isIn(['all', 'department', 'role']).withMessage('目标类型无效'),
    body('targetIds').optional().isArray().withMessage('目标ID必须是数组')
  ],
  update: [
    body('title').optional().notEmpty().withMessage('公告标题不能为空'),
    body('content').optional().notEmpty().withMessage('公告内容不能为空'),
    body('importance').optional().isIn(['normal', 'important', 'urgent']).withMessage('重要程度值无效'),
    body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('状态值无效')
  ]
};

// 日程验证规则
exports.scheduleValidationRules = {
  create: [
    body('title').notEmpty().withMessage('日程标题不能为空'),
    body('startTime').isISO8601().withMessage('开始时间格式无效'),
    body('endTime').isISO8601().withMessage('结束时间格式无效'),
    body('location').optional(),
    body('description').optional(),
    body('participants').optional().isArray().withMessage('参与者必须是数组'),
    body('reminder').optional().isInt().withMessage('提醒时间必须为整数（分钟）')
  ],
  update: [
    body('title').optional().notEmpty().withMessage('日程标题不能为空'),
    body('startTime').optional().isISO8601().withMessage('开始时间格式无效'),
    body('endTime').optional().isISO8601().withMessage('结束时间格式无效'),
    body('status').optional().isIn(['scheduled', 'completed', 'cancelled']).withMessage('状态值无效')
  ]
}; 