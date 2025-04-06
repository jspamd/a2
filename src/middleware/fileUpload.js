const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 确保上传目录存在
const createUploadDir = (dir) => {
  const uploadDir = path.join(__dirname, '../../', dir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// 文档上传配置
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = process.env.DOCUMENT_UPLOAD_PATH || 'uploads/documents';
    const uploadDir = createUploadDir(uploadPath);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

// 文档文件过滤器
const documentFileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = [
    // 文档类型
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/html', 'text/markdown',
    // 图片类型
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // 压缩文件
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
  ];
  
  // 如果是HTML文档，允许text/html类型
  if (req.body && req.body.type === 'html') {
    if (file.mimetype === 'text/html' || file.mimetype === 'text/plain') {
      return cb(null, true);
    }
  }
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

// 头像上传配置
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = process.env.AVATAR_UPLOAD_PATH || 'uploads/avatars';
    const uploadDir = createUploadDir(uploadPath);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

// 头像文件过滤器
const avatarFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('头像必须是图片文件 (JPEG, PNG, GIF, WebP)'), false);
  }
};

// 文件大小限制
const fileSizeLimit = {
  document: 50 * 1024 * 1024, // 50MB
  avatar: 2 * 1024 * 1024     // 2MB
};

// 创建上传中间件
const documentUpload = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: fileSizeLimit.document
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: fileSizeLimit.avatar
  }
});

// 错误处理中间件
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer 错误
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: '文件大小超过限制'
      });
    }
    return res.status(400).json({
      status: 'error',
      message: '文件上传错误',
      error: err.message
    });
  } else if (err) {
    // 其他错误
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
  next();
};

module.exports = {
  documentUpload,
  avatarUpload,
  handleUploadError
}; 