const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { verifyToken, checkRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './uploads/temp');
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv',
    'text/markdown'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

// 所有文档路由都需要认证
router.use(verifyToken);

// 获取文档列表
router.get('/', documentController.getAllDocuments);

// 获取文档详情
router.get('/:id', documentController.getDocumentById);

// 创建文档
router.post('/', upload.single('file'), documentController.createDocument);

// 更新文档
router.put('/:id', upload.single('file'), documentController.updateDocument);

// 删除文档
router.delete('/:id', documentController.deleteDocument);

// 添加文档评论
router.post('/:id/comments', documentController.addDocumentComment);

// 更新文档权限
router.put('/:id/permissions', documentController.updateDocumentPermissions);

// 获取文档版本历史
router.get('/:id/versions', documentController.getDocumentVersions);

// 下载文档
router.get('/:id/download', documentController.downloadDocument);

module.exports = router; 