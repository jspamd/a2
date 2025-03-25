const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 获取所有文档
router.get('/', authMiddleware.verifyToken, documentController.getAllDocuments);

// 获取单个文档
router.get('/:id', authMiddleware.verifyToken, documentController.getDocument);

// 上传文档
router.post('/', authMiddleware.verifyToken, documentController.uploadDocument);

// 更新文档
router.put('/:id', authMiddleware.verifyToken, documentController.updateDocument);

// 删除文档
router.delete('/:id', authMiddleware.verifyToken, documentController.deleteDocument);

// 共享文档
router.post('/:id/share', authMiddleware.verifyToken, documentController.shareDocument);

module.exports = router; 