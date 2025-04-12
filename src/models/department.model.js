module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
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
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '部门管理者ID，关联到User表'
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '上级部门ID，自关联'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
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

  // 定义部门的关联关系
  Department.associate = (models) => {
    // 部门与用户之间是一对多关系
    Department.hasMany(models.User, {
      foreignKey: 'departmentId',
      as: 'users'
    });

    // 部门的自关联（上下级关系）
    Department.belongsTo(Department, {
      foreignKey: 'parentId',
      as: 'parent'
    });
    Department.hasMany(Department, {
      foreignKey: 'parentId',
      as: 'children'
    });
  };

  return { Department };
};