const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');

// 路由处理函数
// 注意：这里暂时用简单的处理函数代替，实际应用中应该引入部门控制器
const departmentController = {
  getAllDepartments: (req, res) => {
    res.status(200).json({
      status: 'success',
      message: '获取所有部门成功',
      data: [
        { id: 1, name: '公司', code: 'root', description: '公司根部门', parentId: null },
        { id: 2, name: '行政部', code: 'admin_dept', description: '行政管理部门', parentId: 1 },
        { id: 3, name: '人力资源部', code: 'hr_dept', description: '人力资源管理部门', parentId: 1 },
        { id: 4, name: '技术部', code: 'tech_dept', description: '技术研发部门', parentId: 1 },
        { id: 5, name: '财务部', code: 'finance_dept', description: '财务管理部门', parentId: 1 }
      ]
    });
  },
  
  getDepartmentById: (req, res) => {
    const deptId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '获取部门成功',
      data: { id: deptId, name: '技术部', code: 'tech_dept', description: '技术研发部门', parentId: 1 }
    });
  },
  
  createDepartment: (req, res) => {
    res.status(201).json({
      status: 'success',
      message: '部门创建成功',
      data: { id: 6, ...req.body }
    });
  },
  
  updateDepartment: (req, res) => {
    const deptId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '部门更新成功',
      data: { id: deptId, ...req.body }
    });
  },
  
  deleteDepartment: (req, res) => {
    const deptId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '部门删除成功',
      data: { id: deptId }
    });
  },
  
  getDepartmentMembers: (req, res) => {
    const deptId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '获取部门成员成功',
      data: [
        { id: 1, username: 'user1', name: '张三', position: '开发工程师' },
        { id: 2, username: 'user2', name: '李四', position: '测试工程师' }
      ]
    });
  },
  
  getDepartmentManager: (req, res) => {
    const deptId = req.params.id;
    res.status(200).json({
      status: 'success',
      message: '获取部门经理成功',
      data: { id: 3, username: 'manager1', name: '王五', position: '部门经理' }
    });
  },
  
  updateDepartmentManager: (req, res) => {
    const deptId = req.params.id;
    const managerId = req.body.managerId;
    res.status(200).json({
      status: 'success',
      message: '更新部门经理成功',
      data: { departmentId: deptId, managerId: managerId }
    });
  }
};

// 获取所有部门
router.get('/', verifyToken, departmentController.getAllDepartments);

// 根据ID获取单个部门
router.get('/:id', verifyToken, departmentController.getDepartmentById);

// 创建新部门 (仅管理员和部门经理)
router.post('/', verifyToken, checkRole(['admin', 'manager']), departmentController.createDepartment);

// 更新部门 (仅管理员和部门经理)
router.put('/:id', verifyToken, checkRole(['admin', 'manager']), departmentController.updateDepartment);

// 删除部门 (仅管理员)
router.delete('/:id', verifyToken, checkRole(['admin']), departmentController.deleteDepartment);

// 获取部门成员
router.get('/:id/members', verifyToken, departmentController.getDepartmentMembers);

// 获取部门经理
router.get('/:id/manager', verifyToken, departmentController.getDepartmentManager);

// 更新部门经理 (仅管理员)
router.put('/:id/manager', verifyToken, checkRole(['admin']), departmentController.updateDepartmentManager);

module.exports = router; 