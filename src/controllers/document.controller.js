const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const { 
  Document, 
  DocumentVersion, 
  DocumentCategory, 
  DocumentShare, 
  DocumentComment, 
  DocumentStar,
  DocumentPermission,
  User,
  Department,
  sequelize
} = require('../models');
const { logError, logInfo } = require('../utils/logger');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');

// 将fs的异步函数转换为Promise
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

// 文件上传目录
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/documents');

// 确保上传目录存在
const ensureUploadDirExists = async () => {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      await mkdirAsync(UPLOAD_DIR, { recursive: true });
    }
  } catch (error) {
    logError('创建上传目录失败', { error: error.message });
    throw new AppError('服务器配置错误：无法创建上传目录', 500);
  }
};

/**
 * 获取文档类别列表
 */
exports.getDocumentCategories = async (req, res, next) => {
  try {
    const categories = await DocumentCategory.findAll({
      order: [['name', 'ASC']]
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取文档类别成功',
      data: categories
    });
  } catch (error) {
    logError('获取文档类别失败', { error: error.message });
    next(error);
  }
};

/**
 * 获取文档列表
 */
exports.getAllDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userDepartmentId = req.user.departmentId;
    
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
              { departmentId: userDepartmentId },
              { isPublic: true }
            ]
          }
        });
        
        whereCondition[Op.or] = [
          { createdBy: userId },
          { isPublic: true },
          { '$shares.id$': { [Op.ne]: null } }
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
          as: 'creator',
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
    logError('获取文档列表失败', { error: error.message });
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
          as: 'creator',
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
    logError('获取最近文档失败', { error: error.message });
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
    const keyword = req.query.keyword || '';
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    const whereCondition = {};
    const includeConditions = [];
    
    // 关键词搜索
    if (keyword) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { tags: { [Op.like]: `%${keyword}%` } }
      ];
    }
    
    // 权限控制
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    
    if (!isAdmin) {
      includeConditions.push({
        model: DocumentShare,
        as: 'shares',
        required: false,
        where: {
          [Op.or]: [
            { userId },
            { departmentId: userDepartmentId },
            { isPublic: true }
          ]
        }
      });
      
      whereCondition[Op.and] = [
        whereCondition[Op.or] || {},
        {
          [Op.or]: [
            { createdBy: userId },
            { isPublic: true },
            { '$shares.id$': { [Op.ne]: null } }
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
          as: 'creator',
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
    logError('搜索文档失败', { error: error.message });
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
          as: 'creator',
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
    logError('获取我的文档失败', { error: error.message });
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
          as: 'creator',
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
    logError('获取共享文档失败', { error: error.message });
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
    const userRoles = req.user.roles;
    const userDepartmentId = req.user.departmentId;

    // 检查文档访问权限
    const hasAccess = await checkDocumentAccess(documentId, userId, userRoles, userDepartmentId);
    if (!hasAccess) {
      throw new AppError('没有权限访问此文档', 403);
    }

    const document = await Document.findByPk(documentId, {
      include: [
        {
          model: User,
          as: 'creator',
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
        }
      ]
    });

    if (!document) {
      throw new AppError('文档不存在', 404);
    }

    res.status(200).json({
      status: 'success',
      message: '获取文档详情成功',
      data: document
    });
  } catch (error) {
    logError('获取文档详情失败', { error: error.message });
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
          as: 'creator',
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
    logError('获取文档版本历史失败', { error: error.message });
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
        name: name || originalname,
        description: description || '',
        categoryId: categoryId || null,
        tags: tags || '',
        isPublic: isPublic === 'true',
        fileType: mimetype,
        fileSize: size,
        createdBy: userId,
        viewCount: 0
      }, { transaction: t });
      
      // 创建文档版本记录
      const version = await DocumentVersion.create({
        documentId: document.id,
        version: 1,
        filePath: relativePath,
        fileName: originalname,
        fileType: mimetype,
        fileSize: size,
        changeLog: '初始版本',
        createdBy: userId
      }, { transaction: t });
      
      return { document, version };
    });
    
    // 查询完整的文档信息（包含关联数据）
    const completeDocument = await Document.findByPk(result.document.id, {
      include: [
        {
          model: User,
          as: 'creator',
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
    
    logInfo('用户上传了新文档', { 
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
    
    logError('上传文档失败', { error: error.message });
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
        originalName: file.originalname
      });

      // 创建新版本记录
      const latestVersion = await DocumentVersion.findOne({
        where: { documentId },
        order: [['version', 'DESC']]
      });

      await DocumentVersion.create({
        documentId,
        version: (latestVersion?.version || 0) + 1,
        filePath: uniqueFileName,
        fileSize: file.size,
        fileType: file.mimetype,
        originalName: file.originalname,
        createdBy: userId
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
    logError('更新文档失败', { error: error.message });
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
          as: 'creator',
          attributes: ['id', 'username', 'name', 'avatar']
        }
      ]
    });
    
    logInfo('用户上传了文档新版本', { 
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
    
    logError('上传文档新版本失败', { error: error.message });
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
    logError('共享文档失败', { error: error.message });
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
    logError('取消共享文档失败', { error: error.message });
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
    logError('删除文档失败', { error: error.message });
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
    logError('添加文档星标失败', { error: error.message });
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
    logError('取消文档星标失败', { error: error.message });
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
          as: 'creator',
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
    logError('获取文档评论失败', { error: error.message });
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
    logError('添加文档评论失败', { error: error.message });
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
    logError('删除文档评论失败', { error: error.message });
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
          as: 'creator',
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
    logError('获取文档版本历史失败', { error: error.message });
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
    logError('下载文档失败', { error: error.message });
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
        model: DocumentPermission,
        as: 'permissions'
      }
    ]
  });
  
  if (!document) {
    return false;
  }
  
  // 文档创建者始终有权限
  if (document.createdBy === userId) {
    return true;
  }
  
  // 检查权限
  const hasPermission = document.permissions.some(p => {
    return (
      (p.targetType === 'user' && p.targetId === userId) ||
      (p.targetType === 'role' && userRoles.some(role => role.id === p.targetId || role === p.targetId)) ||
      (p.targetType === 'department' && p.targetId === userDepartmentId) ||
      (p.targetType === 'all')
    );
  });
  
  return hasPermission;
}

/**
 * 创建文档
 */
exports.createDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, description, categoryId, isPublic, departmentId } = req.body;
    const file = req.file;

    if (!file) {
      throw new AppError('请上传文件', 400);
    }

    // 确保上传目录存在
    await ensureUploadDirExists();

    // 生成唯一文件名
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFileName);

    // 移动文件到目标目录
    await fs.promises.rename(file.path, filePath);

    // 创建文档记录
    const document = await Document.create({
      title,
      description,
      categoryId,
      isPublic,
      departmentId,
      creatorId: userId,
      filePath: uniqueFileName,
      fileSize: file.size,
      fileType: file.mimetype,
      originalName: file.originalname
    });

    // 创建初始版本记录
    await DocumentVersion.create({
      documentId: document.id,
      version: 1,
      filePath: uniqueFileName,
      fileSize: file.size,
      fileType: file.mimetype,
      originalName: file.originalname,
      createdBy: userId
    });

    res.status(201).json({
      status: 'success',
      message: '创建文档成功',
      data: document
    });
  } catch (error) {
    logError('创建文档失败', { error: error.message });
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
    logError('更新文档权限失败', { error: error.message });
    next(error);
  }
}; 