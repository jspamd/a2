const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // 工作流定义模型
  const WorkflowDefinition = sequelize.define('WorkflowDefinition', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '工作流名称'
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '工作流编码'
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '工作流类别，如请假、报销、采购等'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '工作流描述'
    },
    nodeConfig: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      comment: '节点配置JSON，包含审批流程定义',
      get() {
        const rawValue = this.getDataValue('nodeConfig');
        return rawValue ? JSON.parse(rawValue) : null;
      },
      set(value) {
        this.setDataValue('nodeConfig', JSON.stringify(value));
      }
    },
    formConfig: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: '表单配置JSON',
      get() {
        const rawValue = this.getDataValue('formConfig');
        return rawValue ? JSON.parse(rawValue) : null;
      },
      set(value) {
        this.setDataValue('formConfig', value ? JSON.stringify(value) : null);
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'draft'),
      defaultValue: 'draft',
      comment: '工作流状态'
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '工作流版本号'
    },
    isLatest: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '是否为最新版本'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '创建人ID'
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '最后更新人ID'
    }
  }, {
    tableName: 'workflow_definitions',
    timestamps: true
  });

  // 工作流实例模型
  const WorkflowInstance = sequelize.define('WorkflowInstance', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    workflowDefinitionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '工作流定义ID'
    },
    businessKey: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '业务标识，用于关联实际业务数据'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '工作流实例标题'
    },
    formData: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: '表单数据'
    },
    currentNode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '当前节点标识'
    },
    status: {
      type: DataTypes.ENUM('draft', 'processing', 'approved', 'rejected', 'canceled', 'terminated'),
      defaultValue: 'draft',
      comment: '工作流实例状态'
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '工作流开始时间'
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '工作流结束时间'
    },
    initiatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '发起人ID'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium',
      comment: '优先级'
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '截止日期'
    }
  }, {
    tableName: 'workflow_instances',
    timestamps: true
  });

  // 工作流节点实例模型
  const WorkflowNodeInstance = sequelize.define('WorkflowNodeInstance', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    workflowInstanceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '工作流实例ID'
    },
    workflowDefinitionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '工作流定义ID'
    },
    nodeId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '节点标识'
    },
    nodeName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '节点名称'
    },
    nodeType: {
      type: DataTypes.ENUM('start', 'approval', 'condition', 'parallel', 'end', 'service'),
      allowNull: false,
      comment: '节点类型'
    },
    assigneeType: {
      type: DataTypes.ENUM('user', 'role', 'department', 'dynamic', 'initiator', 'supervisor'),
      allowNull: true,
      comment: '审批人类型'
    },
    assigneeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '审批人ID'
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'approved', 'rejected', 'skipped', 'terminated'),
      defaultValue: 'pending',
      comment: '节点状态'
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '审批意见'
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '节点开始时间'
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '节点结束时间'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '处理时长（秒）'
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '节点顺序'
    }
  }, {
    tableName: 'workflow_node_instances',
    timestamps: true
  });

  // 设置关联关系
  WorkflowDefinition.associate = (models) => {
    WorkflowDefinition.hasMany(models.WorkflowInstance, {
      foreignKey: 'workflowDefinitionId',
      as: 'definitionInstances'
    });
  };

  WorkflowInstance.associate = (models) => {
    WorkflowInstance.belongsTo(models.WorkflowDefinition, {
      foreignKey: 'workflowDefinitionId',
      as: 'workflowDefinition'
    });

    WorkflowInstance.hasMany(models.WorkflowNodeInstance, {
      foreignKey: 'workflowInstanceId',
      as: 'nodeInstances'
    });

    WorkflowInstance.belongsTo(models.User, {
      foreignKey: 'initiatorId',
      as: 'initiator'
    });
  };

  WorkflowNodeInstance.associate = (models) => {
    WorkflowNodeInstance.belongsTo(models.WorkflowInstance, {
      foreignKey: 'workflowInstanceId',
      as: 'workflowInstance'
    });

    WorkflowNodeInstance.belongsTo(models.WorkflowDefinition, {
      foreignKey: 'workflowDefinitionId',
      as: 'nodeDefinition'
    });
    
    WorkflowNodeInstance.belongsTo(models.User, {
      foreignKey: 'assigneeId',
      as: 'assignee'
    });
  };

  return {
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowNodeInstance
  };
};
