const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const ProductInformation = sequelize.define('ProductInformation', {
  site: {
    type: DataTypes.STRING(10),
    primaryKey: true,
    allowNull: false,
    comment: '站点/国家信息'
  },
  item_sku: {
    type: DataTypes.STRING(30),
    primaryKey: true,
    allowNull: false,
    comment: '商品SKU'
  },
  original_parent_sku: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '原始父SKU，去掉前两个字符后的结果'
  },
  item_name: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '商品名称'
  },
  external_product_id: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  external_product_id_type: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  brand_name: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  product_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  bullet_point1: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  bullet_point2: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  bullet_point3: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  bullet_point4: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  bullet_point5: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  generic_keywords: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  main_image_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  swatch_image_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url1: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url2: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url3: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url4: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url5: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url6: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url7: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url8: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  parent_child: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  parent_sku: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  relationship_type: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  variation_theme: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  color_name: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  color_map: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  size_name: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  size_map: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  // ========== 新增字段 - 产品基础信息 ==========
  feed_product_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '产品类型'
  },
  item_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '商品类型'
  },
  model: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '型号'
  },
  manufacturer: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '制造商'
  },
  standard_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '标准价格'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '数量'
  },
  list_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '标价'
  },
  // ========== 新增字段 - 产品属性 ==========
  closure_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '闭合类型'
  },
  outer_material_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '外层材料类型（原始字段）'
  },
  outer_material_type1: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '外层材料类型1'
  },
  care_instructions: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '护理说明'
  },
  age_range_description: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '年龄范围描述'
  },
  target_gender: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '目标性别'
  },
  department_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '部门名称'
  },
  special_features: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '特殊功能'
  },
  style_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '风格名称'
  },
  water_resistance_level: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '防水级别'
  },
  recommended_uses_for_product: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '推荐用途'
  },
  // ========== 新增字段 - 季节和生活方式 ==========
  seasons1: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '季节1'
  },
  seasons2: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '季节2'
  },
  seasons3: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '季节3'
  },
  seasons4: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '季节4'
  },
  material_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '材料类型'
  },
  lifestyle1: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '生活方式'
  },
  lining_description: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '内衬描述'
  },
  strap_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '背带类型'
  },
  // ========== 新增字段 - 尺寸和容量 ==========
  storage_volume_unit_of_measure: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '存储容量单位'
  },
  storage_volume: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '存储容量'
  },
  depth_front_to_back: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    comment: '前后深度'
  },
  depth_front_to_back_unit_of_measure: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '前后深度单位'
  },
  depth_width_side_to_side: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    comment: '左右宽度'
  },
  depth_width_side_to_side_unit_of_measure: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '左右宽度单位'
  },
  depth_height_floor_to_top: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    comment: '高度'
  },
  depth_height_floor_to_top_unit_of_measure: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '高度单位'
  },
  // ========== 新增字段 - 合规信息 ==========
  cpsia_cautionary_statement1: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'CPSIA警告声明'
  },
  import_designation: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '进口标识'
  },
  country_of_origin: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '原产国'
  },
  are_batteries_included: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '是否包含电池'
  },
  country_as_labeled: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '标签上的国家'
  },
  condition_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '商品状态类型'
  }
}, {
  tableName: 'product_information',
  timestamps: false, // 禁用自动时间戳管理
  underscored: true
});

module.exports = ProductInformation; 