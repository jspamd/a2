const { Op, Sequelize, literal } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const util = require('util');

// 文件系统异步方法
const unlinkAsync = util.promisify(fs.unlink);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

// 获取数据库模型
let models, sequelize;
let Document, DocumentCategory, DocumentVersion, DocumentComment, DocumentShare, DocumentPermission, User, Department;

const getModels = async () => {
  if (!models) {
    models = await require('../models')();
    sequelize = models.sequelize;
    Document = models.Document;
    DocumentCategory = models.DocumentCategory;
    DocumentVersion = models.DocumentVersion;
    DocumentComment = models.DocumentComment;
    DocumentShare = models.DocumentShare;
    DocumentPermission = models.DocumentPermission;
    User = models.User;
    Department = models.Department;
  }
  return models;
};

// 在每个请求前确保模型已初始化
const ensureModelsInitialized = async () => {
  await getModels();
};

// 文件上传目录
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/documents');

// 确保上传目录存在
const ensureUploadDirExists = async () => {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      await mkdirAsync(UPLOAD_DIR, { recursive: true });
    }
  } catch (error) {
    logger.error('创建上传目录失败', { error: error.message });
    throw new AppError('服务器配置错误：无法创建上传目录', 500);
  }
};

/**
 * 获取文档类别列表
 */
exports.getDocumentCategories = async (req, res, next) => {
  try {
    await ensureModelsInitialized();
    const categories = await DocumentCategory.findAll({
      order: [['name', 'ASC']]
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取文档类别成功',
      data: categories
    });
  } catch (error) {
    logger.error('获取文档类别失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取文档列表
 */
exports.getAllDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userDepartmentId = req.user.departmentId || null;
    
    // 查询参数
    const categoryId = req.query.categoryId;
    const isPublic = req.query.isPublic === 'true';
    const sortBy = req.query.sortBy || 'updatedAt';
    const sortOrder = req.query.sortOrder || 'DESC';
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    const whereCondition = {};
    const includeConditions = [];
    
    // 类别筛选
    if (categoryId) {
      whereCondition.categoryId = categoryId;
    }
    
    // 公共文档或有权限查看的文档
    if (isPublic) {
      whereCondition.isPublic = true;
    } else {
      const isAdmin = req.user.roles && req.user.roles.includes('admin');
      
      if (!isAdmin) {
        includeConditions.push({
          model: DocumentShare,
          as: 'shares',
          required: false,
          where: {
            [Op.or]: [
              { userId },
              ...(userDepartmentId ? [{ departmentId: userDepartmentId }] : [])
            ]
          }
        });
        
        whereCondition[Op.or] = [
          { uploaderId: userId },
          { isPublic: true },
          { id: { [Op.in]: literal('(SELECT documentId FROM document_shares WHERE userId = ' + userId + (userDepartmentId ? ' OR departmentId = ' + userDepartmentId : '') + ')') } }
        ];
      }
    }
    
    // 执行查询
    const { count, rows } = await Document.findAndCountAll({
      where: whereCondition,
      include: [
        ...includeConditions,
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        },
        {
          model: DocumentVersion,
          as: 'versions',
          limit: 1,
          order: [['version', 'DESC']]
        }
      ],
      distinct: true,
      order: [[sortBy, sortOrder]],
      limit,
      offset
    });
    
    // 获取用户的星标文档
    const starredDocuments = await DocumentStar.findAll({
      where: { userId },
      attributes: ['documentId']
    });
    
    const starredDocumentIds = starredDocuments.map(star => star.documentId);
    
    // 添加是否星标标记
    const documentsWithStarred = rows.map(doc => {
      const docJson = doc.toJSON();
      docJson.isStarred = starredDocumentIds.includes(doc.id);
      return docJson;
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取文档列表成功',
      data: documentsWithStarred,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    logger.error('获取文档列表失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取最近文档
 */
exports.getRecentDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    
    const recentDocuments = await Document.findAll({
      where: {
        [Op.or]: [
          { createdBy: userId },
          { 
            '$shares.userId$': userId
          }
        ]
      },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        },
        {
          model: DocumentShare,
          as: 'shares',
          required: false
        }
      ],
      order: [['updatedAt', 'DESC']],
      limit
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取最近文档成功',
      data: recentDocuments
    });
  } catch (error) {
    logger.error('获取最近文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 搜索文档
 */
exports.searchDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userDepartmentId = req.user.departmentId;
    const userRoles = req.user.roles || [];
    const keyword = req.query.keyword || '';
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    const whereCondition = {
      deletedAt: null // 只搜索未删除的文档
    };
    const includeConditions = [];
    
    // 关键词搜索
    if (keyword) {
      whereCondition[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { tags: { [Op.like]: `%${keyword}%` } }
      ];
    }
    
    // 权限控制
    const isAdmin = userRoles.includes('admin');
    
    if (!isAdmin) {
      includeConditions.push({
        model: DocumentShare,
        as: 'shares',
        required: false,
        where: {
          [Op.or]: [
            { userId },
            ...(userDepartmentId ? [{ departmentId: userDepartmentId }] : [])
          ]
        }
      });
      
      whereCondition[Op.and] = [
        whereCondition[Op.or] || {},
        {
          [Op.or]: [
            { uploaderId: userId },
            { isPublic: true },
            { id: { [Op.in]: literal('(SELECT documentId FROM document_shares WHERE userId = ' + userId + (userDepartmentId ? ' OR departmentId = ' + userDepartmentId : '') + ')') } }
          ]
        }
      ];
      
      delete whereCondition[Op.or];
    }
    
    // 执行查询
    const { count, rows } = await Document.findAndCountAll({
      where: whereCondition,
      include: [
        ...includeConditions,
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        }
      ],
      distinct: true,
      order: [['updatedAt', 'DESC']],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '搜索文档成功',
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    logger.error('搜索文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取我的文档
 */
exports.getMyDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 执行查询
    const { count, rows } = await Document.findAndCountAll({
      where: { createdBy: userId },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        },
        {
          model: DocumentVersion,
          as: 'versions',
          limit: 1,
          order: [['version', 'DESC']]
        }
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取我的文档成功',
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    logger.error('获取我的文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取共享给我的文档
 */
exports.getSharedWithMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userDepartmentId = req.user.departmentId;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 执行查询
    const { count, rows } = await Document.findAndCountAll({
      where: {
        createdBy: { [Op.ne]: userId }
      },
      include: [
        {
          model: DocumentShare,
          as: 'shares',
          required: true,
          where: {
            [Op.or]: [
              { userId },
              { departmentId: userDepartmentId }
            ]
          }
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        },
        {
          model: DocumentVersion,
          as: 'versions',
          limit: 1,
          order: [['version', 'DESC']]
        }
      ],
      distinct: true,
      order: [['updatedAt', 'DESC']],
      limit,
      offset
    });
    
    // 计算总页数
    const totalPages = Math.ceil(count / limit);
    
    res.status(200).json({
      status: 'success',
      message: '获取共享文档成功',
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    logger.error('获取共享文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取文档详情
 */
exports.getDocumentById = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const userDepartmentId = req.user.departmentId;

    const document = await Document.findOne({
      where: {
        id: documentId,
        deletedAt: null
      },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'avatar']
        },
        {
          model: DocumentVersion,
          as: 'versions',
          order: [['createdAt', 'DESC']]
        },
        {
          model: DocumentComment,
          as: 'comments',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'avatar']
            }
          ]
        },
        {
          model: DocumentShare,
          as: 'shares'
        },
        {
          model: DocumentPermission,
          as: 'permissions'
        }
      ]
    });

    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    // 管理员有所有权限
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin) {
      // 检查文档访问权限
      const hasAccess = await checkDocumentAccess(documentId, userId, userRoles, userDepartmentId);
      if (!hasAccess) {
        throw new AppError('没有权限访问此文档', 403);
      }
    }

    res.status(200).json({
      status: 'success',
      message: '获取文档详情成功',
      data: document
    });
  } catch (error) {
    logger.error('获取文档详情失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取文档版本历史
 */
exports.getDocumentVersions = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // 检查文档访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, req.user.roles, req.user.departmentId);
    if (!hasAccess) {
      throw new AppError('没有权限查看此文档的版本历史', 403);
    }

    const versions = await DocumentVersion.findAll({
      where: { documentId },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'avatar']
        }
      ],
      order: [['version', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      message: '获取文档版本历史成功',
      data: versions
    });
  } catch (error) {
    logger.error('获取文档版本历史失败', { error: error.message });
    next(error);
  }
};

/**
 * 上传文档
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return next(new AppError('请上传文件', 400));
    }
    
    const userId = req.user.id;
    const {
      name,
      description,
      categoryId,
      tags,
      isPublic
    } = req.body;
    
    // 验证必填字段
    if (!name) {
      // 删除已上传的文件
      await unlinkAsync(req.file.path);
      return next(new AppError('文档名称为必填项', 400));
    }
    
    // 检查类别是否存在
    if (categoryId) {
      const category = await DocumentCategory.findByPk(categoryId);
      if (!category) {
        // 删除已上传的文件
        await unlinkAsync(req.file.path);
        return next(new AppError('选择的类别不存在', 400));
      }
    }
    
    // 获取文件信息
    const { filename, originalname, mimetype, size, path: filePath } = req.file;
    
    // 计算相对路径（从uploads文件夹开始）
    const uploadDir = process.env.UPLOAD_PATH || 'uploads/documents';
    const relativePath = path.join(uploadDir, filename).replace(/\\/g, '/');
    
    // 事务处理
    const result = await sequelize.transaction(async (t) => {
      // 创建文档记录
      const document = await Document.create({
        title: name || originalname,
        description: description || '',
        categoryId: categoryId || null,
        isPublic: isPublic === 'true',
        departmentId: null,
        filename: filename,
        originalName: originalname,
        path: filePath,
        mimetype: mimetype,
        size: size,
        uploaderId: userId,
        viewCount: 0
      }, { transaction: t });
      
      // 创建文档版本记录
      const version = await DocumentVersion.create({
        documentId: document.id,
        version: '1.0',
        filename: filename,
        path: filePath,
        size: size,
        updaterId: userId,
        changeLog: '初始版本'
      }, { transaction: t });
      
      return { document, version };
    });
    
    // 查询完整的文档信息（包含关联数据）
    const completeDocument = await Document.findByPk(result.document.id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        },
        {
          model: DocumentVersion,
          as: 'versions',
          limit: 1,
          order: [['version', 'DESC']]
        }
      ]
    });
    
    logger.info('用户上传了新文档', { 
      documentId: result.document.id,
      userId,
      fileName: originalname
    });
    
    res.status(201).json({
      status: 'success',
      message: '文档上传成功',
      data: completeDocument
    });
  } catch (error) {
    // 删除已上传的文件
    if (req.file) {
      await unlinkAsync(req.file.path);
    }
    
    logger.error('上传文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 更新文档
 */
exports.updateDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const { title, description, categoryId, isPublic, departmentId } = req.body;
    const file = req.file;

    // 检查文档访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, req.user.roles, req.user.departmentId);
    if (!hasAccess) {
      throw new AppError('没有权限修改此文档', 403);
    }

    const document = await Document.findByPk(documentId);
    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    // 如果有新文件上传
    if (file) {
      // 确保上传目录存在
      await ensureUploadDirExists();

      // 生成唯一文件名
      const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
      const filePath = path.join(UPLOAD_DIR, uniqueFileName);

      // 移动文件到目标目录
      await fs.promises.rename(file.path, filePath);

      // 删除旧文件
      if (document.filePath) {
        const oldFilePath = path.join(UPLOAD_DIR, document.filePath);
        if (fs.existsSync(oldFilePath)) {
          await unlinkAsync(oldFilePath);
        }
      }

      // 创建新版本记录
      const latestVersion = await DocumentVersion.findOne({
        where: { documentId },
        order: [['version', 'DESC']]
      });

      const newVersion = await DocumentVersion.create({
        documentId,
        version: (latestVersion?.version || 0) + 1,
        filename: file.originalname,
        path: filePath,
        size: file.size,
        uploaderId: userId,
        changeLog: req.body.changeLog || '更新文档'
      });

      // 更新文档记录
      await document.update({
        title,
        description,
        categoryId,
        isPublic,
        departmentId,
        filePath: uniqueFileName,
        fileSize: file.size,
        fileType: file.mimetype,
        originalName: file.originalname,
        version: newVersion.version
      });
    } else {
      // 仅更新文档信息
      await document.update({
        title,
        description,
        categoryId,
        isPublic,
        departmentId
      });
    }

    res.status(200).json({
      status: 'success',
      message: '更新文档成功',
      data: document
    });
  } catch (error) {
    logger.error('更新文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 上传新版本
 */
exports.uploadNewVersion = async (req, res, next) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return next(new AppError('请上传文件', 400));
    }
    
    const documentId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const { changeLog } = req.body;
    
    // 查询文档
    const document = await Document.findByPk(documentId, {
      include: [
        {
          model: DocumentVersion,
          as: 'versions',
          order: [['version', 'DESC']],
          limit: 1
        }
      ]
    });
    
    if (!document) {
      // 删除已上传的文件
      await unlinkAsync(req.file.path);
      return next(new AppError('文档不存在', 404));
    }
    
    // 权限检查
    if (!isAdmin && document.createdBy !== userId) {
      // 删除已上传的文件
      await unlinkAsync(req.file.path);
      return next(new AppError('您没有权限更新此文档', 403));
    }
    
    // 获取当前最新版本号
    const currentVersion = document.versions.length > 0 ? document.versions[0].version : 0;
    
    // 获取文件信息
    const { filename, originalname, mimetype, size, path: filePath } = req.file;
    
    // 计算相对路径（从uploads文件夹开始）
    const uploadDir = process.env.UPLOAD_PATH || 'uploads/documents';
    const relativePath = path.join(uploadDir, filename).replace(/\\/g, '/');
    
    // 创建新版本记录
    const newVersion = await DocumentVersion.create({
      documentId,
      version: currentVersion + 1,
      filePath: relativePath,
      fileName: originalname,
      fileType: mimetype,
      fileSize: size,
      changeLog: changeLog || '更新版本',
      createdBy: userId
    });
    
    // 更新文档的更新时间
    await document.update({
      updatedAt: new Date()
    });
    
    // 查询完整的版本信息
    const completeVersion = await DocumentVersion.findByPk(newVersion.id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        }
      ]
    });
    
    logger.info('用户上传了文档新版本', { 
      documentId,
      versionId: newVersion.id,
      userId,
      version: currentVersion + 1
    });
    
    res.status(201).json({
      status: 'success',
      message: '文档新版本上传成功',
      data: completeVersion
    });
  } catch (error) {
    // 删除已上传的文件
    if (req.file) {
      await unlinkAsync(req.file.path);
    }
    
    logger.error('上传文档新版本失败', { error: error.message });
    next(error);
  }
};

/**
 * 共享文档
 */
exports.shareDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const { 
      userIds, 
      departmentIds, 
      isPublic,
      permission 
    } = req.body;
    
    // 验证参数
    if (!userIds && !departmentIds && isPublic === undefined) {
      return next(new AppError('请指定共享对象', 400));
    }
    
    // 查询文档
    const document = await Document.findByPk(documentId);
    
    if (!document) {
      return next(new AppError('文档不存在', 404));
    }
    
    // 权限检查
    if (!isAdmin && document.createdBy !== userId) {
      return next(new AppError('您没有权限共享此文档', 403));
    }
    
    // 如果设置了公开状态，更新文档
    if (isPublic !== undefined) {
      await document.update({
        isPublic: isPublic === true || isPublic === 'true'
      });
    }
    
    // 添加用户共享
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // 验证用户是否存在
      const users = await User.findAll({
        where: { id: userIds }
      });
      
      if (users.length !== userIds.length) {
        return next(new AppError('部分用户不存在', 400));
      }
      
      // 批量创建共享记录
      for (const targetUserId of userIds) {
        await DocumentShare.findOrCreate({
          where: {
            documentId,
            userId: targetUserId,
            departmentId: null
          },
          defaults: {
            permission: permission || 'read',
            sharedBy: userId
          }
        });
      }
    }
    
    // 添加部门共享
    if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
      // 验证部门是否存在
      const departments = await Department.findAll({
        where: { id: departmentIds }
      });
      
      if (departments.length !== departmentIds.length) {
        return next(new AppError('部分部门不存在', 400));
      }
      
      // 批量创建共享记录
      for (const targetDeptId of departmentIds) {
        await DocumentShare.findOrCreate({
          where: {
            documentId,
            departmentId: targetDeptId,
            userId: null
          },
          defaults: {
            permission: permission || 'read',
            sharedBy: userId
          }
        });
      }
    }
    
    // 获取更新后的共享列表
    const shares = await DocumentShare.findAll({
      where: { documentId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: Department,
          as: 'department'
        },
        {
          model: User,
          as: 'sharer',
          attributes: ['id', 'username', 'name', 'avatar']
        }
      ]
    });
    
    res.status(200).json({
      status: 'success',
      message: '文档共享成功',
      data: {
        isPublic: document.isPublic,
        shares
      }
    });
  } catch (error) {
    logger.error('共享文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 取消共享文档
 */
exports.unshareDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const targetUserId = req.params.userId;
    const userId = req.user.id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    
    // 查询文档
    const document = await Document.findByPk(documentId);
    
    if (!document) {
      return next(new AppError('文档不存在', 404));
    }
    
    // 权限检查
    if (!isAdmin && document.createdBy !== userId) {
      return next(new AppError('您没有权限修改此文档的共享设置', 403));
    }
    
    // 删除共享记录
    await DocumentShare.destroy({
      where: {
        documentId,
        userId: targetUserId
      }
    });
    
    res.status(200).json({
      status: 'success',
      message: '已取消与该用户的文档共享'
    });
  } catch (error) {
    logger.error('取消共享文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 删除文档
 */
exports.deleteDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // 检查文档访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, req.user.roles, req.user.departmentId);
    if (!hasAccess) {
      throw new AppError('没有权限删除此文档', 403);
    }

    const document = await Document.findByPk(documentId);
    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    // 删除文件
    if (document.filePath) {
      const filePath = path.join(UPLOAD_DIR, document.filePath);
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
      }
    }

    // 删除文档记录
    await document.destroy();

    res.status(200).json({
      status: 'success',
      message: '删除文档成功'
    });
  } catch (error) {
    logger.error('删除文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 星标文档
 */
exports.starDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    
    // 查询文档
    const document = await Document.findByPk(documentId);
    
    if (!document) {
      return next(new AppError('文档不存在', 404));
    }
    
    // 检查是否已星标
    const existingStar = await DocumentStar.findOne({
      where: {
        documentId,
        userId
      }
    });
    
    if (existingStar) {
      return res.status(200).json({
        status: 'success',
        message: '文档已经是星标状态'
      });
    }
    
    // 创建星标记录
    await DocumentStar.create({
      documentId,
      userId
    });
    
    res.status(200).json({
      status: 'success',
      message: '文档已添加星标'
    });
  } catch (error) {
    logger.error('添加文档星标失败', { error: error.message });
    next(error);
  }
};

/**
 * 取消文档星标
 */
exports.unstarDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    
    // 删除星标记录
    await DocumentStar.destroy({
      where: {
        documentId,
        userId
      }
    });
    
    res.status(200).json({
      status: 'success',
      message: '已取消文档星标'
    });
  } catch (error) {
    logger.error('取消文档星标失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取文档评论
 */
exports.getDocumentComments = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    
    // 查询文档
    const document = await Document.findByPk(documentId);
    
    if (!document) {
      return next(new AppError('文档不存在', 404));
    }
    
    // 查询评论
    const comments = await DocumentComment.findAll({
      where: { documentId },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取文档评论成功',
      data: comments
    });
  } catch (error) {
    logger.error('获取文档评论失败', { error: error.message });
    next(error);
  }
};

/**
 * 添加文档评论
 */
exports.addDocumentComment = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    // 检查文档访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, req.user.roles, req.user.departmentId);
    if (!hasAccess) {
      throw new AppError('没有权限评论此文档', 403);
    }

    const comment = await DocumentComment.create({
      documentId,
      userId,
      content
    });

    res.status(201).json({
      status: 'success',
      message: '添加评论成功',
      data: comment
    });
  } catch (error) {
    logger.error('添加文档评论失败', { error: error.message });
    next(error);
  }
};

/**
 * 删除文档评论
 */
exports.deleteDocumentComment = async (req, res, next) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    
    // 查询评论
    const comment = await DocumentComment.findByPk(commentId);
    
    if (!comment) {
      return next(new AppError('评论不存在', 404));
    }
    
    // 权限检查
    if (!isAdmin && comment.createdBy !== userId) {
      return next(new AppError('您没有权限删除此评论', 403));
    }
    
    // 删除评论
    await comment.destroy();
    
    res.status(200).json({
      status: 'success',
      message: '评论删除成功'
    });
  } catch (error) {
    logger.error('删除文档评论失败', { error: error.message });
    next(error);
  }
};

/**
 * 下载文档
 */
exports.downloadDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // 检查文档访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, req.user.roles, req.user.departmentId);
    if (!hasAccess) {
      throw new AppError('没有权限下载此文档', 403);
    }

    const document = await Document.findByPk(documentId);
    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    const filePath = path.join(UPLOAD_DIR, document.filePath);
    if (!fs.existsSync(filePath)) {
      throw new AppError('文件不存在', 404);
    }

    res.download(filePath, document.originalName);
  } catch (error) {
    logger.error('下载文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 辅助函数：检查用户是否有文档访问权限
 */
async function checkDocumentAccess(documentId, userId, userRoles, userDepartmentId) {
  // 查询文档
  const document = await Document.findByPk(documentId, {
    include: [
      {
        model: DocumentShare,
        as: 'shares'
      },
      {
        model: DocumentPermission,
        as: 'permissions'
      }
    ]
  });
  
  if (!document) {
    return false;
  }
  
  // 管理员有所有权限
  if (userRoles && userRoles.includes('admin')) {
    return true;
  }
  
  // 文档创建者有权限
  if (document.uploaderId === userId) {
    return true;
  }
  
  // 公开文档所有人都有权限
  if (document.isPublic) {
    return true;
  }
  
  // 检查共享权限
  if (document.shares && document.shares.length > 0) {
    const hasShare = document.shares.some(share => {
      return (
        share.userId === userId ||
        (userDepartmentId && share.departmentId === userDepartmentId)
      );
    });
    
    if (hasShare) {
      return true;
    }
  }
  
  // 检查权限
  if (document.permissions && document.permissions.length > 0) {
    const hasPermission = document.permissions.some(p => {
      if (p.targetType === 'user' && p.targetId === userId) {
        return true;
      }
      if (p.targetType === 'role' && userRoles && userRoles.some(role => 
        typeof role === 'object' ? role.id === p.targetId : role === p.targetId
      )) {
        return true;
      }
      if (p.targetType === 'department' && p.targetId === userDepartmentId) {
        return true;
      }
      if (p.targetType === 'all') {
        return true;
      }
      return false;
    });
    
    if (hasPermission) {
      return true;
    }
  }
  
  return false;
}

/**
 * 创建文档
 */
exports.createDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, content, description, categoryId, isPublic } = req.body;

    // 验证必填字段
    if (!title) {
      return next(new AppError('文档标题为必填项', 400));
    }

    // 如果指定了分类，检查其是否存在
    if (categoryId) {
      const category = await DocumentCategory.findByPk(categoryId);
      if (!category) {
        return next(new AppError('选择的分类不存在', 404));
      }
    }

    // 生成唯一文件名
    const filename = `${uuidv4()}.html`;
    const filePath = path.join('documents', filename);

    // 创建HTML文档记录
    const document = await Document.create({
      title,
      content: content || '',
      description: description || '',
      categoryId: categoryId || null,
      isPublic: isPublic === 'true',
      uploaderId: userId,
      type: 'html',
      viewCount: 0,
      filename: filename,
      path: filePath,
      size: Buffer.from(content || '').length
    });

    // 创建文档版本记录
    await DocumentVersion.create({
      documentId: document.id,
      version: '1.0',
      content: content || '',
      updaterId: userId,
      changeLog: '初始版本',
      filename: filename,
      path: filePath,
      size: Buffer.from(content || '').length,
      uploaderId: userId
    });

    // 查询完整的文档信息
    const completeDocument = await Document.findByPk(document.id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        },
        {
          model: DocumentVersion,
          as: 'versions',
          limit: 1,
          order: [['version', 'DESC']]
        }
      ]
    });

    logger.info('用户创建了新HTML文档', { 
      documentId: document.id,
      userId,
      title
    });

    res.status(201).json({
      status: 'success',
      message: '文档创建成功',
      data: completeDocument
    });
  } catch (error) {
    logger.error('创建HTML文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 更新文档权限
 */
exports.updateDocumentPermissions = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const { shares } = req.body;

    // 检查文档访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, req.user.roles, req.user.departmentId);
    if (!hasAccess) {
      throw new AppError('没有权限修改此文档的权限', 403);
    }

    // 删除旧的共享记录
    await DocumentShare.destroy({
      where: { documentId }
    });

    // 创建新的共享记录
    if (shares && shares.length > 0) {
      await DocumentShare.bulkCreate(
        shares.map(share => ({
          documentId,
          ...share
        }))
      );
    }

    res.status(200).json({
      status: 'success',
      message: '更新文档权限成功'
    });
  } catch (error) {
    logger.error('更新文档权限失败', { error: error.message });
    next(error);
  }
};

/**
 * 创建文件夹
 */
exports.createFolder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, description, parentId, isPublic } = req.body;

    // 验证必填字段
    if (!title) {
      return next(new AppError('文件夹名称为必填项', 400));
    }

    // 如果指定了父文件夹，检查其是否存在
    if (parentId) {
      const parentFolder = await Document.findOne({
        where: { 
          id: parentId,
          type: 'folder'
        }
      });
      
      if (!parentFolder) {
        return next(new AppError('父文件夹不存在', 404));
      }
    }

    // 创建文件夹记录
    const folder = await Document.create({
      title,
      description: description || '',
      parentId: parentId || null,
      isPublic: isPublic === 'true',
      type: 'folder',
      uploaderId: userId
    });

    // 查询完整的文件夹信息
    const completeFolder = await Document.findByPk(folder.id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'name', 'avatar']
        }
      ]
    });

    logger.info('用户创建了新文件夹', { 
      folderId: folder.id,
      userId,
      title
    });

    res.status(201).json({
      status: 'success',
      message: '文件夹创建成功',
      data: completeFolder
    });
  } catch (error) {
    logger.error('创建文件夹失败', { error: error.message });
    next(error);
  }
};

/**
 * 创建文档分类
 */
exports.createDocumentCategory = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    
    // 验证必填字段
    if (!name || !code) {
      throw new AppError('分类名称和代码为必填项', 400);
    }
    
    // 检查分类代码是否已存在
    const existingCategory = await DocumentCategory.findOne({
      where: { code }
    });
    
    if (existingCategory) {
      throw new AppError('分类代码已存在', 400);
    }
    
    // 创建分类
    const category = await DocumentCategory.create({
      name,
      code,
      description,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      status: 'success',
      message: '创建文档分类成功',
      data: category
    });
  } catch (error) {
    logger.error('创建文档分类失败', { error: error.message });
    next(error);
  }
};

/**
 * 更新文档分类
 */
exports.updateDocumentCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    
    // 查找分类
    const category = await DocumentCategory.findByPk(id);
    if (!category) {
      throw new AppError('文档分类不存在', 404);
    }
    
    // 如果更新代码，检查是否与其他分类冲突
    if (code && code !== category.code) {
      const existingCategory = await DocumentCategory.findOne({
        where: { code }
      });
      
      if (existingCategory) {
        throw new AppError('分类代码已存在', 400);
      }
    }
    
    // 更新分类
    await category.update({
      name: name || category.name,
      code: code || category.code,
      description: description || category.description
    });
    
    res.status(200).json({
      status: 'success',
      message: '更新文档分类成功',
      data: category
    });
  } catch (error) {
    logger.error('更新文档分类失败', { error: error.message });
    next(error);
  }
};

/**
 * 删除文档分类
 */
exports.deleteDocumentCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 查找分类
    const category = await DocumentCategory.findByPk(id);
    if (!category) {
      throw new AppError('文档分类不存在', 404);
    }
    
    // 检查是否有文档使用此分类
    const documentCount = await Document.count({
      where: { categoryId: id }
    });
    
    if (documentCount > 0) {
      throw new AppError('无法删除：该分类下存在文档', 400);
    }
    
    // 删除分类
    await category.destroy();
    
    res.status(200).json({
      status: 'success',
      message: '删除文档分类成功'
    });
  } catch (error) {
    logger.error('删除文档分类失败', { error: error.message });
    next(error);
  }
};

/**
 * 预览文档
 */
exports.previewDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const userDepartmentId = req.user.departmentId;

    // 管理员有所有权限
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin) {
      // 检查文档访问权限
      const hasAccess = await checkDocumentAccess(documentId, userId, userRoles, userDepartmentId);
      if (!hasAccess) {
        throw new AppError('没有权限预览此文档', 403);
      }
    }

    const document = await Document.findByPk(documentId, {
      include: [
        {
          model: DocumentVersion,
          as: 'versions',
          order: [['version', 'DESC']],
          limit: 1
        }
      ]
    });

    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    // 增加文档浏览次数
    await document.increment('accessCount');

    // 获取最新版本的内容
    const latestVersion = document.versions[0];
    const content = latestVersion ? latestVersion.content : '';

    res.status(200).json({
      status: 'success',
      message: '获取文档预览成功',
      data: {
        id: document.id,
        title: document.title,
        content: content,
        version: latestVersion ? latestVersion.version : '1.0',
        viewCount: document.accessCount + 1
      }
    });
  } catch (error) {
    logger.error('获取文档预览失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取文档统计信息
 */
exports.getDocumentStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const userDepartmentId = req.user.departmentId;

    // 构建查询条件
    const whereCondition = {
      deletedAt: null
    };
    const includeConditions = [];

    // 权限控制
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin) {
      includeConditions.push({
        model: DocumentShare,
        as: 'shares',
        required: false,
        where: {
          [Op.or]: [
            { userId },
            ...(userDepartmentId ? [{ departmentId: userDepartmentId }] : [])
          ]
        }
      });

      whereCondition[Op.or] = [
        { uploaderId: userId },
        { isPublic: true },
        { id: { [Op.in]: literal('(SELECT documentId FROM document_shares WHERE userId = ' + userId + (userDepartmentId ? ' OR departmentId = ' + userDepartmentId : '') + ')') } }
      ];
    }

    // 获取文档总数
    const totalDocuments = await Document.count({
      where: whereCondition,
      include: includeConditions,
      distinct: true
    });

    // 获取分类统计
    const categoryStats = await Document.findAll({
      attributes: [
        'categoryId',
        [sequelize.fn('COUNT', sequelize.col('Document.id')), 'count']
      ],
      where: whereCondition,
      include: [
        {
          model: DocumentCategory,
          as: 'category',
          attributes: ['name'],
          required: false
        }
      ],
      group: ['Document.categoryId', 'category.id'],
      having: literal('COUNT(Document.id) > 0')
    });

    // 获取最近一周的文档创建趋势
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const dailyStats = await Document.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('Document.id')), 'count']
      ],
      where: {
        ...whereCondition,
        createdAt: {
          [Op.gte]: lastWeek
        }
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))]
    });

    res.status(200).json({
      status: 'success',
      message: '获取文档统计信息成功',
      data: {
        totalDocuments,
        categoryStats: categoryStats.map(stat => ({
          categoryId: stat.categoryId,
          categoryName: stat.category ? stat.category.name : '未分类',
          count: parseInt(stat.getDataValue('count'))
        })),
        dailyStats: dailyStats.map(stat => ({
          date: stat.getDataValue('date'),
          count: parseInt(stat.getDataValue('count'))
        }))
      }
    });
  } catch (error) {
    logger.error('获取文档统计信息失败', { error: error.message });
    next(error);
  }
};

/**
 * 比较文档版本
 */
exports.compareDocumentVersions = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const { version1, version2 } = req.query;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const userDepartmentId = req.user.departmentId;

    // 管理员有所有权限
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin) {
      // 检查文档访问权限
      const hasAccess = await checkDocumentAccess(documentId, userId, userRoles, userDepartmentId);
      if (!hasAccess) {
        throw new AppError('没有权限比较此文档的版本', 403);
      }
    }

    // 获取要比较的两个版本
    const versions = await DocumentVersion.findAll({
      where: {
        documentId,
        version: {
          [Op.in]: [version1, version2]
        }
      },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'avatar']
        }
      ],
      order: [['version', 'ASC']]
    });

    if (versions.length !== 2) {
      throw new AppError('指定的版本不存在', 404);
    }

    res.status(200).json({
      status: 'success',
      message: '获取文档版本比较成功',
      data: {
        version1: {
          version: versions[0].version,
          content: versions[0].content,
          updatedAt: versions[0].updatedAt,
          changeLog: versions[0].changeLog,
          uploader: versions[0].uploader
        },
        version2: {
          version: versions[1].version,
          content: versions[1].content,
          updatedAt: versions[1].updatedAt,
          changeLog: versions[1].changeLog,
          uploader: versions[1].uploader
        }
      }
    });
  } catch (error) {
    logger.error('比较文档版本失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取文档权限
 */
exports.getDocumentPermissions = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const userDepartmentId = req.user.departmentId;

    // 检查文档是否存在
    const document = await Document.findByPk(documentId, {
      include: [
        {
          model: DocumentPermission,
          as: 'permissions',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'avatar']
            },
            {
              model: Department,
              as: 'department',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    // 检查访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, userRoles, userDepartmentId);
    if (!hasAccess) {
      throw new AppError('没有权限访问此文档', 403);
    }

    res.status(200).json({
      status: 'success',
      message: '获取文档权限成功',
      data: document.permissions
    });
  } catch (error) {
    logger.error('获取文档权限失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取回收站文档列表
 */
exports.getRecycleBin = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    // 构建查询条件
    const whereCondition = {
      deletedAt: {
        [Op.ne]: null
      }
    };

    // 非管理员只能看到自己的文档
    if (!userRoles.includes('admin')) {
      whereCondition.uploaderId = userId;
    }

    const documents = await Document.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        }
      ],
      paranoid: false // 包含已删除的记录
    });

    res.status(200).json({
      status: 'success',
      message: '获取回收站文档列表成功',
      data: documents
    });
  } catch (error) {
    logger.error('获取回收站文档列表失败', { error: error.message });
    next(error);
  }
};

/**
 * 恢复回收站中的文档
 */
exports.restoreDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    // 查找文档（包括已删除的）
    const document = await Document.findOne({
      where: { id: documentId },
      paranoid: false
    });

    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    // 检查权限
    if (!userRoles.includes('admin') && document.uploaderId !== userId) {
      throw new AppError('没有权限恢复此文档', 403);
    }

    // 恢复文档
    await document.restore();

    // 获取完整的文档信息
    const restoredDocument = await Document.findByPk(document.id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'avatar']
        },
        {
          model: DocumentCategory,
          as: 'category'
        }
      ]
    });

    res.status(200).json({
      status: 'success',
      message: '文档恢复成功',
      data: restoredDocument
    });
  } catch (error) {
    logger.error('恢复文档失败', { error: error.message });
    next(error);
  }
};

/**
 * 永久删除文档
 */
exports.deleteDocumentPermanently = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    // 查找文档（包括已删除的）
    const document = await Document.findOne({
      where: { id: documentId },
      paranoid: false
    });

    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    // 检查权限
    if (!userRoles.includes('admin') && document.uploaderId !== userId) {
      throw new AppError('没有权限删除此文档', 403);
    }

    // 永久删除文档
    await document.destroy({ force: true });

    res.status(200).json({
      status: 'success',
      message: '文档永久删除成功'
    });
  } catch (error) {
    logger.error('永久删除文档失败', { error: error.message });
    next(error);
  }
}; 