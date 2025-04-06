const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { documentUpload, handleUploadError } = require('../middleware/fileUpload');

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
  // 如果是创建文件夹，跳过文件类型检查
  if (req.path === '/folders') {
    cb(null, true);
    return;
  }

  // 如果是HTML文档，允许text/html类型
  if (req.body.type === 'html' || file.mimetype === 'text/html') {
    cb(null, true);
    return;
  }

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
    'text/markdown',
    'text/html',
    'application/json',
    'application/xml',
    'application/zip',
    'application/x-rar-compressed'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
}).single('file');

// 所有文档路由都需要认证
router.use(verifyToken);

// 文档分类路由
router.post('/categories', documentController.createDocumentCategory);
router.get('/categories', documentController.getDocumentCategories);
router.put('/categories/:id', documentController.updateDocumentCategory);
router.delete('/categories/:id', documentController.deleteDocumentCategory);

// 获取文档列表
router.get('/', documentController.getAllDocuments);

// 获取文档统计信息
router.get('/stats', documentController.getDocumentStats);

// 回收站相关路由
router.get('/recycle', documentController.getRecycleBin);
router.post('/recycle/:id/restore', documentController.restoreDocument);
router.delete('/recycle/:id', documentController.deleteDocumentPermanently);

// 创建文档
router.post('/', documentUpload.single('file'), handleUploadError, documentController.createDocument);

// 创建文件夹
router.post('/folders', documentController.createFolder);

// 获取文档详情
router.get('/:id', documentController.getDocumentById);

// 更新文档
router.put('/:id', documentUpload.single('file'), handleUploadError, documentController.updateDocument);

// 删除文档
router.delete('/:id', documentController.deleteDocument);

// 获取文档版本历史
router.get('/:id/versions', documentController.getDocumentVersions);

// 下载文档
router.get('/:id/download', documentController.downloadDocument);

// 预览文档
router.get('/:id/preview', documentController.previewDocument);

// 比较文档版本
router.get('/:id/compare', documentController.compareDocumentVersions);

// 添加文档评论
router.post('/:id/comments', documentController.addDocumentComment);

// 更新文档权限
router.put('/:id/permissions', documentController.updateDocumentPermissions);

// 获取文档权限
router.get('/:id/permissions', documentController.getDocumentPermissions);

module.exports = router; 