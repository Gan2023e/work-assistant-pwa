const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始修复product_information表结构...');
    
    try {
      // 首先检查表是否存在
      const tableExists = await queryInterface.showAllTables();
      const hasProductInformationTable = tableExists.includes('product_information');
      
      if (!hasProductInformationTable) {
        console.log('📋 表不存在，创建新的product_information表...');
        
        // 创建表（与模型定义匹配）
        await queryInterface.createTable('product_information', {
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
            type: DataTypes.STRING(255),
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
            type: DataTypes.STRING(255),
            allowNull: true
          },
          bullet_point2: {
            type: DataTypes.STRING(255),
            allowNull: true
          },
          bullet_point3: {
            type: DataTypes.STRING(255),
            allowNull: true
          },
          bullet_point4: {
            type: DataTypes.STRING(255),
            allowNull: true
          },
          bullet_point5: {
            type: DataTypes.STRING(255),
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
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          },
          updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          }
        });
        
        console.log('✅ 成功创建product_information表（复合主键）');
      } else {
        console.log('📋 表已存在，检查和修复表结构...');
        
        // 检查列信息
        const columns = await queryInterface.describeTable('product_information');
        
        // 检查是否有created_at字段
        if (!columns.created_at) {
          console.log('➕ 添加created_at字段...');
          await queryInterface.addColumn('product_information', 'created_at', {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          });
        }
        
        // 检查是否有updated_at字段
        if (!columns.updated_at) {
          console.log('➕ 添加updated_at字段...');
          await queryInterface.addColumn('product_information', 'updated_at', {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          });
        }
        
        // 检查主键设置
        if (columns.id) {
          console.log('⚠️ 发现旧的id主键，需要重建表结构以使用复合主键...');
          
          // 备份数据
                     const backupData = await queryInterface.sequelize.query(
             'SELECT * FROM product_information',
             { type: queryInterface.sequelize.QueryTypes.SELECT }
           );
          
          // 删除旧表
          await queryInterface.dropTable('product_information');
          
          // 重新创建表（使用复合主键）
          await queryInterface.createTable('product_information', {
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
              type: DataTypes.STRING(255),
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
              type: DataTypes.STRING(255),
              allowNull: true
            },
            bullet_point2: {
              type: DataTypes.STRING(255),
              allowNull: true
            },
            bullet_point3: {
              type: DataTypes.STRING(255),
              allowNull: true
            },
            bullet_point4: {
              type: DataTypes.STRING(255),
              allowNull: true
            },
            bullet_point5: {
              type: DataTypes.STRING(255),
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
            created_at: {
              type: DataTypes.DATE,
              allowNull: false,
              defaultValue: DataTypes.NOW
            },
            updated_at: {
              type: DataTypes.DATE,
              allowNull: false,
              defaultValue: DataTypes.NOW
            }
          });
          
          // 恢复数据（如果有的话）
          if (backupData.length > 0) {
            console.log(`📊 恢复 ${backupData.length} 条历史数据...`);
            for (const row of backupData) {
              if (row.site && row.item_sku) {
                await queryInterface.bulkInsert('product_information', [{
                  ...row,
                  created_at: row.created_at || new Date(),
                  updated_at: row.updated_at || new Date()
                }]);
              }
            }
          }
          
          console.log('✅ 成功重建product_information表结构');
        }
        
        console.log('✅ product_information表结构修复完成');
      }
      
      // 创建索引
      try {
        await queryInterface.addIndex('product_information', ['original_parent_sku']);
        console.log('✅ 添加索引完成');
      } catch (indexError) {
        console.log('ℹ️ 索引可能已存在，跳过创建');
      }
      
    } catch (error) {
      console.error('❌ 修复product_information表结构失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 回滚product_information表结构修复...');
    
    try {
      // 这个操作不可逆，只记录警告
      console.log('⚠️ 此迁移的回滚操作不可逆，请手动处理');
      
    } catch (error) {
      console.error('❌ 回滚失败:', error);
      throw error;
    }
  }
}; 