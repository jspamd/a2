const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '..', '..', process.env.UPLOAD_PATH || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`创建上传目录: ${uploadDir}`);
}

// 设置文档存储
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const documentDir = path.join(uploadDir, 'documents');
    if (!fs.existsSync(documentDir)) {
      fs.mkdirSync(documentDir, { recursive: true });
    }
    cb(null, documentDir);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = uuidv4();
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});

// 设置头像存储
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const avatarDir = path.join(uploadDir, 'avatars');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniquePrefix + ext);
  }
});

// 设置附件存储
const attachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const attachmentDir = path.join(uploadDir, 'attachments');
    if (!fs.existsSync(attachmentDir)) {
      fs.mkdirSync(attachmentDir, { recursive: true });
    }
    cb(null, attachmentDir);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = uuidv4();
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 设置允许的文件类型
  const allowedMimes = [
    'image/jpeg', 
    'image/png', 
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

// 图片过滤器
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'), false);
  }
};

// 创建上传实例
const documentUpload = multer({ 
  storage: documentStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const avatarUpload = multer({ 
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

const attachmentUpload = multer({ 
  storage: attachmentStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

module.exports = {
  documentUpload,
  avatarUpload,
  attachmentUpload,
  uploadDir
}; 