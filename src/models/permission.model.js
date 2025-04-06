module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define('Permission', {
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
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '模块名称，如user, workflow等'
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '操作类型，如create, read, update, delete等'
    }
  }, {
    timestamps: true,
    paranoid: true,  // 软删除
    indexes: [
      {
        unique: true,
        fields: ['code']
      },
      {
        fields: ['module']
      }
    ]
  });

  return { Permission };
};