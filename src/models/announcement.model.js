module.exports = (sequelize, DataTypes) => {
  // 公告模型
  const Announcement = sequelize.define('Announcement', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('system', 'department', 'notice', 'event', 'other'),
      defaultValue: 'notice',
      comment: '公告类型'
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
      comment: '优先级'
    },
    publisherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '发布者ID，关联到User表'
    },
    publishTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '发布时间，null表示尚未发布'
    },
    expireTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '过期时间，null表示永不过期'
    },
    attachments: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '附件路径，多个附件用逗号分隔'
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'expired', 'archived'),
      defaultValue: 'draft'
    },
    needConfirmation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否需要确认已读'
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '查看次数'
    },
    targetType: {
      type: DataTypes.ENUM('all', 'department', 'role', 'user'),
      defaultValue: 'all',
      comment: '目标类型，确定公告针对的人群'
    }
  }, {
    timestamps: true,
    paranoid: true  // 软删除
  });

  // 公告目标表 - 存储公告的目标部门、角色或用户
  const AnnouncementTarget = sequelize.define('AnnouncementTarget', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    announcementId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '公告ID'
    },
    targetType: {
      type: DataTypes.ENUM('department', 'role', 'user'),
      allowNull: false,
      comment: '目标类型'
    },
    targetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '目标ID，根据targetType关联到相应的表'
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['announcementId', 'targetType', 'targetId'],
        unique: true
      }
    ]
  });

  // 公告已读记录
  const AnnouncementRead = sequelize.define('AnnouncementRead', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    announcementId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '公告ID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    readTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '阅读时间'
    },
    confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否已确认阅读'
    },
    confirmTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '确认时间'
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['announcementId', 'userId'],
        unique: true
      }
    ]
  });

  // 设置关联关系
  Announcement.hasMany(AnnouncementTarget, { foreignKey: 'announcementId', as: 'targets' });
  AnnouncementTarget.belongsTo(Announcement, { foreignKey: 'announcementId' });

  Announcement.hasMany(AnnouncementRead, { foreignKey: 'announcementId', as: 'readRecords' });
  AnnouncementRead.belongsTo(Announcement, { foreignKey: 'announcementId' });

  return {
    Announcement,
    AnnouncementTarget,
    AnnouncementRead
  };
};