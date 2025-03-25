const { Document, DocumentShare } = require('../models');
const { Sequelize } = require('sequelize');

/**
 * 获取所有文档
 */
exports.getAllDocuments = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 查询文档列表
    const { count, rows } = await Document.findAndCountAll({
      where: {
        [Sequelize.Op.or]: [
          { createdBy: userId }, // 自己创建的文档
          { 
            '$shares.userId$': userId, // 共享给自己的文档
            '$shares.status$': 'active'
          }
        ]
      },
      include: [
        { 
          model: DocumentShare, 
          as: 'shares',
          required: false
        }
      ],
      distinct: true,
      limit,
      offset,
      order: [['updatedAt', 'DESC']]
    });

    // 计算总页数
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      status: 'success',
      data: {
        documents: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取文档列表错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取文档列表过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取单个文档
 */
exports.getDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.userId;

    // 查询文档
    const document = await Document.findByPk(documentId, {
      include: [
        { 
          model: DocumentShare, 
          as: 'shares'
        }
      ]
    });

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: '文档不存在'
      });
    }

    // 检查访问权限
    const hasAccess = 
      document.createdBy === userId || 
      document.shares.some(share => share.userId === userId && share.status === 'active');

    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权访问此文档'
      });
    }

    res.status(200).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    console.error('获取文档错误:', error);
    res.status(500).json({
      status: 'error',
      message: '获取文档信息过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 上传文档
 */
exports.uploadDocument = async (req, res) => {
  try {
    const { title, content, type, tags } = req.body;
    const userId = req.userId;
    
    // 创建文档
    const document = await Document.create({
      title,
      content,
      type,
      tags,
      createdBy: userId,
      status: 'active'
    });

    res.status(201).json({
      status: 'success',
      message: '文档上传成功',
      data: document
    });
  } catch (error) {
    console.error('上传文档错误:', error);
    res.status(500).json({
      status: 'error',
      message: '上传文档过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 更新文档
 */
exports.updateDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    const { title, content, tags } = req.body;
    const userId = req.userId;

    // 查询文档
    const document = await Document.findByPk(documentId);
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: '文档不存在'
      });
    }

    // 检查权限
    if (document.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权更新此文档'
      });
    }

    // 更新文档
    await document.update({
      title,
      content,
      tags
    });

    res.status(200).json({
      status: 'success',
      message: '文档更新成功',
      data: document
    });
  } catch (error) {
    console.error('更新文档错误:', error);
    res.status(500).json({
      status: 'error',
      message: '更新文档过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 删除文档
 */
exports.deleteDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.userId;

    // 查询文档
    const document = await Document.findByPk(documentId);
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: '文档不存在'
      });
    }

    // 检查权限
    if (document.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权删除此文档'
      });
    }

    // 删除文档
    await document.destroy();

    res.status(200).json({
      status: 'success',
      message: '文档删除成功'
    });
  } catch (error) {
    console.error('删除文档错误:', error);
    res.status(500).json({
      status: 'error',
      message: '删除文档过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 共享文档
 */
exports.shareDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    const { userIds, permissions } = req.body;
    const userId = req.userId;

    // 查询文档
    const document = await Document.findByPk(documentId);
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: '文档不存在'
      });
    }

    // 检查权限
    if (document.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: '无权共享此文档'
      });
    }

    // 创建共享记录
    const shareRecords = await Promise.all(
      userIds.map(async (targetUserId) => {
        // 检查是否已存在共享记录
        const existingShare = await DocumentShare.findOne({
          where: {
            documentId,
            userId: targetUserId
          }
        });

        if (existingShare) {
          // 更新现有共享
          await existingShare.update({
            permissions,
            status: 'active'
          });
          return existingShare;
        } else {
          // 创建新共享
          return await DocumentShare.create({
            documentId,
            userId: targetUserId,
            permissions,
            status: 'active',
            sharedBy: userId
          });
        }
      })
    );

    res.status(200).json({
      status: 'success',
      message: '文档共享成功',
      data: shareRecords
    });
  } catch (error) {
    console.error('共享文档错误:', error);
    res.status(500).json({
      status: 'error',
      message: '共享文档过程中发生错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 