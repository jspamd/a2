module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    rank: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '角色级别，数字越小权限越高'
    }
  }, {
    timestamps: true,
    paranoid: true,  // 软删除
    indexes: [
      {
        unique: true,
        fields: ['code']
      }
    ]
  });

  // 建立角色与用户、权限的关系
  Role.associate = (models) => {
    // 一个角色可以分配给多个用户
    Role.hasMany(models.User, {
      foreignKey: 'roleId',
      as: 'users'
    });

    // 角色与权限是多对多关系
    Role.belongsToMany(models.Permission, {
      through: 'RolePermissions',
      foreignKey: 'roleId',
      otherKey: 'permissionId',
      as: 'permissions'
    });
  };

  return Role;
};

