const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始为product_information表添加缺失的字段...');
    
    try {
      // ========== 产品基础信息字段 ==========
      console.log('📋 添加产品基础信息字段...');
      
      await queryInterface.addColumn('product_information', 'feed_product_type', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '产品类型'
      });
      
      await queryInterface.addColumn('product_information', 'item_type', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '商品类型'
      });
      
      await queryInterface.addColumn('product_information', 'model', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '型号'
      });
      
      await queryInterface.addColumn('product_information', 'manufacturer', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '制造商'
      });
      
      await queryInterface.addColumn('product_information', 'standard_price', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: '标准价格'
      });
      
      await queryInterface.addColumn('product_information', 'quantity', {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '数量'
      });
      
      await queryInterface.addColumn('product_information', 'list_price', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: '标价'
      });
      
      // ========== 产品属性字段 ==========
      console.log('🏷️ 添加产品属性字段...');
      
      await queryInterface.addColumn('product_information', 'closure_type', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '闭合类型'
      });
      
      await queryInterface.addColumn('product_information', 'outer_material_type1', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '外层材料类型'
      });
      
      await queryInterface.addColumn('product_information', 'care_instructions', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '护理说明'
      });
      
      await queryInterface.addColumn('product_information', 'age_range_description', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '年龄范围描述'
      });
      
      await queryInterface.addColumn('product_information', 'target_gender', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '目标性别'
      });
      
      await queryInterface.addColumn('product_information', 'department_name', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '部门名称'
      });
      
      await queryInterface.addColumn('product_information', 'special_features', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '特殊功能'
      });
      
      await queryInterface.addColumn('product_information', 'style_name', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '风格名称'
      });
      
      await queryInterface.addColumn('product_information', 'water_resistance_level', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '防水级别'
      });
      
      await queryInterface.addColumn('product_information', 'recommended_uses_for_product', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '推荐用途'
      });
      
      // ========== 季节和生活方式字段 ==========
      console.log('🌟 添加季节和生活方式字段...');
      
      await queryInterface.addColumn('product_information', 'seasons1', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '季节1'
      });
      
      await queryInterface.addColumn('product_information', 'seasons2', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '季节2'
      });
      
      await queryInterface.addColumn('product_information', 'seasons3', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '季节3'
      });
      
      await queryInterface.addColumn('product_information', 'seasons4', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '季节4'
      });
      
      await queryInterface.addColumn('product_information', 'material_type', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '材料类型'
      });
      
      await queryInterface.addColumn('product_information', 'lifestyle1', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '生活方式'
      });
      
      await queryInterface.addColumn('product_information', 'lining_description', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '内衬描述'
      });
      
      await queryInterface.addColumn('product_information', 'strap_type', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '背带类型'
      });
      
      // ========== 尺寸和容量字段 ==========
      console.log('📏 添加尺寸和容量字段...');
      
      await queryInterface.addColumn('product_information', 'storage_volume_unit_of_measure', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '存储容量单位'
      });
      
      await queryInterface.addColumn('product_information', 'storage_volume', {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '存储容量'
      });
      
      await queryInterface.addColumn('product_information', 'depth_front_to_back', {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        comment: '前后深度'
      });
      
      await queryInterface.addColumn('product_information', 'depth_front_to_back_unit_of_measure', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '前后深度单位'
      });
      
      await queryInterface.addColumn('product_information', 'depth_width_side_to_side', {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        comment: '左右宽度'
      });
      
      await queryInterface.addColumn('product_information', 'depth_width_side_to_side_unit_of_measure', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '左右宽度单位'
      });
      
      await queryInterface.addColumn('product_information', 'depth_height_floor_to_top', {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        comment: '高度'
      });
      
      await queryInterface.addColumn('product_information', 'depth_height_floor_to_top_unit_of_measure', {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '高度单位'
      });
      
      // ========== 合规信息字段 ==========
      console.log('⚖️ 添加合规信息字段...');
      
      await queryInterface.addColumn('product_information', 'cpsia_cautionary_statement1', {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'CPSIA警告声明'
      });
      
      await queryInterface.addColumn('product_information', 'import_designation', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '进口标识'
      });
      
      await queryInterface.addColumn('product_information', 'country_of_origin', {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '原产国'
      });
      
      console.log('✅ 成功为product_information表添加所有缺失字段');
    } catch (error) {
      console.error('❌ 添加字段失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 开始回滚product_information表的字段添加...');
    
    try {
      // 按照相反顺序删除字段
      const fieldsToRemove = [
        'country_of_origin',
        'import_designation', 
        'cpsia_cautionary_statement1',
        'depth_height_floor_to_top_unit_of_measure',
        'depth_height_floor_to_top',
        'depth_width_side_to_side_unit_of_measure',
        'depth_width_side_to_side',
        'depth_front_to_back_unit_of_measure',
        'depth_front_to_back',
        'storage_volume',
        'storage_volume_unit_of_measure',
        'strap_type',
        'lining_description',
        'lifestyle1',
        'material_type',
        'seasons4',
        'seasons3',
        'seasons2',
        'seasons1',
        'recommended_uses_for_product',
        'water_resistance_level',
        'style_name',
        'special_features',
        'department_name',
        'target_gender',
        'age_range_description',
        'care_instructions',
        'outer_material_type1',
        'closure_type',
        'list_price',
        'quantity',
        'standard_price',
        'manufacturer',
        'model',
        'item_type',
        'feed_product_type'
      ];
      
      for (const field of fieldsToRemove) {
        await queryInterface.removeColumn('product_information', field);
      }
      
      console.log('✅ 成功回滚所有添加的字段');
    } catch (error) {
      console.error('❌ 回滚字段失败:', error);
      throw error;
    }
  }
}; 