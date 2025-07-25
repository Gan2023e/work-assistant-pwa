const { sequelize } = require('../models/database');
const SellerInventorySku = require('../models/SellerInventorySku');

async function checkAndCreateTables() {
    try {
        console.log('🔗 连接数据库...');
        
        // 测试数据库连接
        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');
        
        // 检查sellerinventory_sku表是否存在
        const [results] = await sequelize.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'sellerinventory_sku'
        `);
        
        if (results[0].count === 0) {
            console.log('📋 sellerinventory_sku表不存在，正在创建...');
            
            // 创建表
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS sellerinventory_sku (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    parent_sku VARCHAR(255) NOT NULL COMMENT '父SKU',
                    child_sku VARCHAR(255) NOT NULL COMMENT '子SKU',
                    sellercolorname VARCHAR(255) NULL COMMENT '卖家颜色名称',
                    sellersizename VARCHAR(255) NULL COMMENT '卖家尺寸名称',
                    qty_per_box INT NULL COMMENT '单箱产品数量'
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
            
            console.log('✅ sellerinventory_sku表创建成功');
        } else {
            console.log('✅ sellerinventory_sku表已存在');
            
            // 检查qty_per_box字段是否存在
            const [columns] = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM information_schema.columns 
                WHERE table_schema = DATABASE() 
                AND table_name = 'sellerinventory_sku' 
                AND column_name = 'qty_per_box'
            `);
            
            if (columns.length === 0) {
                console.log('📋 添加qty_per_box字段...');
                await sequelize.query(`
                    ALTER TABLE sellerinventory_sku 
                    ADD COLUMN qty_per_box INT NULL COMMENT '单箱产品数量'
                `);
                console.log('✅ qty_per_box字段添加成功');
            } else {
                console.log('✅ qty_per_box字段已存在');
            }
            
            // 检查id字段是否存在
            const [idColumns] = await sequelize.query(`
                SELECT COLUMN_NAME 
                FROM information_schema.columns 
                WHERE table_schema = DATABASE() 
                AND table_name = 'sellerinventory_sku' 
                AND column_name = 'id'
            `);
            
            if (idColumns.length === 0) {
                console.log('📋 添加id主键字段...');
                await sequelize.query(`
                    ALTER TABLE sellerinventory_sku 
                    ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST
                `);
                console.log('✅ id主键字段添加成功');
            } else {
                console.log('✅ id主键字段已存在');
            }
        }
        
        // 同步模型
        await SellerInventorySku.sync({ alter: true });
        console.log('✅ 模型同步完成');
        
        // 插入测试数据（如果没有数据的话）
        const testCount = await SellerInventorySku.count();
        if (testCount === 0) {
            console.log('📋 插入测试数据...');
            await SellerInventorySku.create({
                parent_sku: 'TEST',
                child_sku: 'XB362D1',
                sellercolorname: 'Black',
                sellersizename: 'One Size',
                qty_per_box: 12
            });
            console.log('✅ 测试数据插入成功');
        }
        
        console.log('🎉 生产环境表结构检查完成！');
        
    } catch (error) {
        console.error('❌ 检查失败:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    checkAndCreateTables()
        .then(() => {
            console.log('✅ 脚本执行完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = { checkAndCreateTables }; 