module.exports = (sequelize, DataTypes) => {
  // 导入其他模型
  const User = sequelize.models.User;
  const Department = sequelize.models.Department;

  // 文档分类模型
  const DocumentCategory = sequelize.define('DocumentCategory', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '分类名称'
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '分类编码'
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '父分类ID，null表示一级分类'
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '分类路径'
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '级别'
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '排序值'
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '描述'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      comment: '状态'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建人ID'
    }
  }, {
    tableName: 'document_categories',
    timestamps: true
  });

  // 文档模型
  const Document = sequelize.define('Document', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('file', 'folder', 'html'),
      allowNull: false,
      defaultValue: 'file',
      comment: '文档类型：file-文件，folder-文件夹，html-HTML文档'
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    mimetype: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '文件大小，单位字节'
    },
    extension: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '文档分类ID'
    },
    tags: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '标签，以逗号分隔'
    },
    uploaderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '上传者ID，关联到User表'
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'deleted'),
      defaultValue: 'active'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否公开'
    },
    accessCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '访问次数'
    },
    lastAccessTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    version: {
      type: DataTypes.STRING(20),
      defaultValue: '1.0',
      comment: '文档版本'
    },
    originalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '原始文档ID，用于版本管理'
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '父文件夹ID'
    },
    folderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '所属文件夹ID'
    }
  }, {
    timestamps: true,
    paranoid: true  // 软删除
  });

  // 文档权限模型
  const DocumentPermission = sequelize.define('DocumentPermission', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    documentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '文档ID'
    },
    targetType: {
      type: DataTypes.ENUM('user', 'role', 'department', 'all'),
      allowNull: false,
      comment: '目标类型'
    },
    targetId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '目标ID，当targetType为all时可为空'
    },
    permissionType: {
      type: DataTypes.ENUM('read', 'edit', 'delete', 'full'),
      allowNull: false,
      defaultValue: 'read',
      comment: '权限类型'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建人ID'
    }
  }, {
    tableName: 'document_permissions',
    timestamps: true
  });

  // 文件夹模型
  const Folder = sequelize.define('Folder', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '父文件夹ID，根文件夹为null'
    },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '创建者ID，关联到User表'
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'deleted'),
      defaultValue: 'active'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否公开'
    }
  }, {
    timestamps: true,
    paranoid: true  // 软删除
  });

  // 文档共享记录
  const DocumentShare = sequelize.define('DocumentShare', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    documentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '文档ID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '被共享用户ID'
    },
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '被共享部门ID'
    },
    permission: {
      type: DataTypes.ENUM('read', 'edit', 'full'),
      defaultValue: 'read',
      comment: 'read-只读,edit-可编辑,full-完全控制'
    },
    sharedById: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '共享者ID'
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '过期时间，null表示永不过期'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否公开共享'
    }
  }, {
    tableName: 'document_shares',
    timestamps: true
  });

  // 文档版本历史
  const DocumentVersion = sequelize.define('DocumentVersion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    documentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '文档ID'
    },
    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: '版本号'
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '文件大小，单位字节'
    },
    uploaderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '上传者ID'
    },
    changeLog: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '变更说明'
    }
  }, {
    tableName: 'document_versions',
    timestamps: true
  });

  // 文档评论模型
  const DocumentComment = sequelize.define('DocumentComment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    documentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '文档ID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '评论者ID'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '评论内容'
    }
  }, {
    tableName: 'document_comments',
    timestamps: true
  });

  // 文档收藏模型
  const DocumentStar = sequelize.define('DocumentStar', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    documentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '文档ID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    }
  }, {
    tableName: 'document_stars',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['documentId', 'userId']
      }
    ]
  });

  // 添加标准的associate方法
  Document.associate = (models) => {
    // 文档与文档分类的关联
    Document.belongsTo(models.DocumentCategory, {
      foreignKey: 'categoryId',
      as: 'category'
    });

    // 文档版本关联
    Document.hasMany(models.DocumentVersion, {
      foreignKey: 'documentId',
      as: 'versions'
    });

    // 文档与权限的关联
    Document.hasMany(models.DocumentPermission, {
      foreignKey: 'documentId',
      as: 'permissions'
    });

    // 文件夹与文档关联
    Document.belongsTo(models.Folder, { 
      foreignKey: 'folderId', 
      as: 'folder' 
    });

    // 文档共享关联
    Document.hasMany(models.DocumentShare, { 
      foreignKey: 'documentId', 
      as: 'shares' 
    });

    // 文档评论关联
    Document.hasMany(models.DocumentComment, {
      foreignKey: 'documentId',
      as: 'comments'
    });

    // 文档收藏关联
    Document.hasMany(models.DocumentStar, {
      foreignKey: 'documentId',
      as: 'stars'
    });

    // 与上传者的关联
    Document.belongsTo(models.User, { 
      foreignKey: 'uploaderId', 
      as: 'uploader' 
    });
  };

  DocumentCategory.associate = (models) => {
    // 文档分类自关联
    DocumentCategory.hasMany(models.DocumentCategory, {
      foreignKey: 'parentId',
      as: 'children'
    });

    DocumentCategory.belongsTo(models.DocumentCategory, {
      foreignKey: 'parentId',
      as: 'parent'
    });

    // 文档与文档分类的关联
    DocumentCategory.hasMany(models.Document, {
      foreignKey: 'categoryId',
      as: 'documents'
    });
  };

  DocumentVersion.associate = (models) => {
    DocumentVersion.belongsTo(models.Document, {
      foreignKey: 'documentId',
      as: 'document'
    });

    // 文档版本关联
    DocumentVersion.belongsTo(models.User, {
      foreignKey: 'uploaderId',
      as: 'uploader'
    });
  };

  DocumentPermission.associate = (models) => {
    DocumentPermission.belongsTo(models.Document, {
      foreignKey: 'documentId',
      as: 'document'
    });

    // 文档权限和用户、部门的关联
    DocumentPermission.belongsTo(models.User, { 
      foreignKey: 'targetId', 
      as: 'user', 
      constraints: false 
    });
    
    DocumentPermission.belongsTo(models.Department, { 
      foreignKey: 'targetId', 
      as: 'department', 
      constraints: false 
    });
  };

  Folder.associate = (models) => {
    Folder.hasMany(models.Document, { 
      foreignKey: 'folderId', 
      as: 'documents' 
    });

    // 文件夹自关联
    Folder.belongsTo(models.Folder, { 
      foreignKey: 'parentId', 
      as: 'parent' 
    });
    
    Folder.hasMany(models.Folder, { 
      foreignKey: 'parentId', 
      as: 'subFolders' 
    });
  };

  DocumentShare.associate = (models) => {
    DocumentShare.belongsTo(models.Document, { 
      foreignKey: 'documentId', 
      as: 'document' 
    });

    // 文档共享关联
    DocumentShare.belongsTo(models.User, {
      foreignKey: 'sharedById',
      as: 'sharedBy'
    });
    
    DocumentShare.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'sharedTo'
    });
    
    DocumentShare.belongsTo(models.Department, {
      foreignKey: 'departmentId',
      as: 'department'
    });
  };

  DocumentComment.associate = (models) => {
    DocumentComment.belongsTo(models.Document, {
      foreignKey: 'documentId',
      as: 'document'
    });

    DocumentComment.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  DocumentStar.associate = (models) => {
    DocumentStar.belongsTo(models.Document, {
      foreignKey: 'documentId',
      as: 'document'
    });

    DocumentStar.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return {
    DocumentCategory,
    Document,
    DocumentPermission,
    Folder,
    DocumentShare,
    DocumentVersion,
    DocumentComment,
    DocumentStar
  };
};