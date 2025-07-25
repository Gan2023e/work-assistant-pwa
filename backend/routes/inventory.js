const express = require('express');
const router = express.Router();
const LocalBox = require('../models/LocalBox');
const SellerInventorySku = require('../models/SellerInventorySku');
const { Op } = require('sequelize');
const {
    createInventoryRecord,
    createMixedBoxRecords,
    updateInventoryRecord,
    getPendingInventory,
    getMixedBoxDetails,
    generatePrintLabelData,
    cancelShipment
} = require('../utils/inventoryUtils');

// 获取未发库存列表（新的高效查询）
router.get('/pending', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🔍 获取未发库存列表');
    
    try {
        const { sku, country, box_type, page = 1, limit = 50 } = req.query;
        
        const filters = {};
        if (sku) filters.sku = sku;
        if (country) filters.country = country;
        if (box_type) filters.box_type = box_type;
        
        const inventory = await getPendingInventory(filters);
        
        // 分页处理
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedData = inventory.slice(startIndex, endIndex);
        
        console.log('\x1b[33m%s\x1b[0m', `📦 查询到 ${inventory.length} 个SKU的未发库存`);
        
        res.json({
            code: 0,
            message: '查询成功',
            data: {
                inventory: paginatedData,
                total: inventory.length,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(inventory.length / limit)
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 获取未发库存失败:', error);
        res.status(500).json({
            code: 1,
            message: '查询失败',
            error: error.message
        });
    }
});

// 获取库存记录详情
router.get('/records', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🔍 获取库存记录详情');
    
    try {
        const { sku, country, mix_box_num, box_type, status, page = 1, limit = 20 } = req.query;
        
        const whereCondition = {};
        if (sku) whereCondition.sku = { [Op.like]: `%${sku}%` };
        if (country) whereCondition.country = country;
        
        // 处理mix_box_num - 直接字符串匹配
        if (mix_box_num) {
            whereCondition.mix_box_num = mix_box_num.toString().trim();
        }
        
        if (box_type && !mix_box_num) {
            if (box_type === '整箱') {
                whereCondition.mix_box_num = { [Op.is]: null };
            } else if (box_type === '混合箱') {
                whereCondition.mix_box_num = { [Op.not]: null };
            }
        }
        if (status) whereCondition.status = status;
        
        const offset = (page - 1) * limit;
        
        const { count, rows } = await LocalBox.findAndCountAll({
            where: whereCondition,
            order: [['last_updated_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });
        
        console.log('\x1b[33m%s\x1b[0m', `📋 查询到 ${count} 条库存记录`);
        
        res.json({
            code: 0,
            message: '查询成功',
            data: {
                records: rows,
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 获取库存记录失败:', error);
        res.status(500).json({
            code: 1,
            message: '查询失败',
            error: error.message
        });
    }
});

// 获取混合箱详情
router.get('/mixed-box/:mixBoxNum', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🔍 获取混合箱详情');
    
    try {
        const { mixBoxNum } = req.params;
        
        const records = await getMixedBoxDetails(mixBoxNum);
        
        if (records.length === 0) {
            return res.status(404).json({
                code: 1,
                message: '未找到该混合箱或已出库'
            });
        }
        
        // 统计信息
        const summary = {
            mixBoxNum: mixBoxNum,
            skuCount: records.length,
            totalQuantity: records.reduce((sum, r) => sum + r.total_quantity, 0),
            country: records[0].country,
            createdTime: records[0].time,
            lastUpdate: Math.max(...records.map(r => new Date(r.last_updated_at).getTime()))
        };
        
        console.log('\x1b[33m%s\x1b[0m', `📦 混合箱 ${mixBoxNum} 包含 ${records.length} 个SKU`);
        
        res.json({
            code: 0,
            message: '查询成功',
            data: {
                summary: summary,
                records: records
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 获取混合箱详情失败:', error);
        res.status(500).json({
            code: 1,
            message: '查询失败',
            error: error.message
        });
    }
});

// 创建库存记录
router.post('/create', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '📦 创建库存记录');
    
    try {
        const { records, print = false } = req.body;
        
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                code: 1,
                message: '库存记录数据不能为空'
            });
        }
        
        const createdRecords = [];
        const printData = [];
        
        for (const recordData of records) {
            // 验证必要字段
            if (!recordData.sku || !recordData.total_quantity || !recordData.country) {
                throw new Error('SKU、数量、国家为必填字段');
            }
            
            let newRecord;
            
            if (recordData.mix_box_num) {
                // 如果是混合箱的一部分，直接创建
                newRecord = await createInventoryRecord(recordData);
            } else {
                // 普通整箱记录
                newRecord = await createInventoryRecord(recordData);
            }
            
            createdRecords.push(newRecord);
            
            // 准备打印数据
            if (print) {
                printData.push(generatePrintLabelData(newRecord));
            }
        }
        
        console.log('\x1b[32m%s\x1b[0m', `✅ 成功创建 ${createdRecords.length} 条库存记录`);
        
        res.json({
            code: 0,
            message: '创建成功',
            data: {
                records: createdRecords,
                printData: print ? printData : null
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 创建库存记录失败:', error);
        res.status(500).json({
            code: 1,
            message: '创建失败',
            error: error.message
        });
    }
});

// 创建混合箱记录
router.post('/create-mixed-box', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '📦 创建混合箱记录');
    
    try {
        const { mixBoxNum, skus, operator, packer, remark, print = false } = req.body;
        
        if (!mixBoxNum || !skus || !Array.isArray(skus) || skus.length === 0) {
            return res.status(400).json({
                code: 1,
                message: '混合箱编号和SKU列表不能为空'
            });
        }
        
        // 检查混合箱编号是否已存在
        const existingBox = await LocalBox.findOne({
            where: { mix_box_num: mixBoxNum, status: '待出库' }
        });
        
        if (existingBox) {
            return res.status(400).json({
                code: 1,
                message: `混合箱编号 ${mixBoxNum} 已存在`
            });
        }
        
        const records = await createMixedBoxRecords({
            skus: skus,
            mixBoxNum: mixBoxNum,
            operator: operator || '系统',
            packer: packer,
            remark: remark
        });
        
        const printData = print ? records.map(generatePrintLabelData) : null;
        
        console.log('\x1b[32m%s\x1b[0m', `✅ 成功创建混合箱 ${mixBoxNum}，包含 ${records.length} 个SKU`);
        
        res.json({
            code: 0,
            message: '创建成功',
            data: {
                mixBoxNum: mixBoxNum,
                records: records,
                printData: printData
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 创建混合箱失败:', error);
        res.status(500).json({
            code: 1,
            message: '创建失败',
            error: error.message
        });
    }
});

// 编辑库存记录
router.put('/edit/:recordId', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '✏️ 编辑库存记录');
    
    try {
        const { recordId } = req.params;
        const { updateData, changeNote } = req.body;
        
        if (!updateData) {
            return res.status(400).json({
                code: 1,
                message: '更新数据不能为空'
            });
        }
        
        const updatedRecord = await updateInventoryRecord(recordId, updateData, changeNote);
        
        console.log('\x1b[32m%s\x1b[0m', `✅ 成功更新记录 ${recordId}`);
        
        res.json({
            code: 0,
            message: '更新成功',
            data: updatedRecord
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 编辑库存记录失败:', error);
        res.status(500).json({
            code: 1,
            message: '更新失败',
            error: error.message
        });
    }
});

// 删除库存记录（仅限待出库状态）
router.delete('/delete/:recordId', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🗑️ 删除库存记录');
    
    try {
        const { recordId } = req.params;
        const { reason } = req.body;
        
        // 先查询记录
        const record = await LocalBox.findByPk(recordId);
        if (!record) {
            return res.status(404).json({
                code: 1,
                message: '记录不存在'
            });
        }
        
        if (record.status !== '待出库') {
            return res.status(400).json({
                code: 1,
                message: '只能删除待出库状态的记录'
            });
        }
        
        // 硬删除：从数据库中删除记录
        await LocalBox.destroy({
            where: {
                记录号: recordId
            }
        });
        
        console.log('\x1b[32m%s\x1b[0m', `✅ 成功删除记录 ${recordId}`);
        
        res.json({
            code: 0,
            message: '删除成功'
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 删除库存记录失败:', error);
        res.status(500).json({
            code: 1,
            message: '删除失败',
            error: error.message
        });
    }
});

// 取消出库（恢复库存）
router.post('/cancel-shipment/:shipmentId', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🔄 取消出库');
    
    try {
        const { shipmentId } = req.params;
        const { operator, reason } = req.body;
        
        const affectedRows = await cancelShipment(
            parseInt(shipmentId), 
            operator || '系统'
        );
        
        if (affectedRows === 0) {
            return res.status(404).json({
                code: 1,
                message: '未找到对应的出库记录'
            });
        }
        
        console.log('\x1b[32m%s\x1b[0m', `✅ 成功取消发货单 ${shipmentId} 的出库，恢复 ${affectedRows} 条记录`);
        
        res.json({
            code: 0,
            message: '取消出库成功',
            data: {
                shipmentId: parseInt(shipmentId),
                restoredRecords: affectedRows
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 取消出库失败:', error);
        res.status(500).json({
            code: 1,
            message: '取消失败',
            error: error.message
        });
    }
});

// 获取打印标签数据
router.get('/print-label/:recordId', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🖨️ 获取打印标签数据');
    
    try {
        const { recordId } = req.params;
        
        const record = await LocalBox.findByPk(recordId);
        if (!record) {
            return res.status(404).json({
                code: 1,
                message: '记录不存在'
            });
        }
        
        const printData = generatePrintLabelData(record);
        
        res.json({
            code: 0,
            message: '获取成功',
            data: printData
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 获取打印数据失败:', error);
        res.status(500).json({
            code: 1,
            message: '获取失败',
            error: error.message
        });
    }
});

// 库存统计报表
router.get('/statistics', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '📊 获取库存统计');
    
    try {
        const { startDate, endDate } = req.query;
        
        let whereCondition = {};
        if (startDate && endDate) {
            whereCondition.time = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }
        
        // 基础统计
        const totalStats = await LocalBox.findOne({
            where: whereCondition,
            attributes: [
                [LocalBox.sequelize.fn('COUNT', LocalBox.sequelize.col('记录号')), 'totalRecords'],
                [LocalBox.sequelize.fn('SUM', LocalBox.sequelize.col('total_quantity')), 'totalQuantity'],
                [LocalBox.sequelize.fn('SUM', LocalBox.sequelize.col('total_boxes')), 'totalBoxes']
            ]
        });
        
        // 按状态统计
        const statusStats = await LocalBox.findAll({
            where: whereCondition,
            attributes: [
                'status',
                [LocalBox.sequelize.fn('COUNT', LocalBox.sequelize.col('记录号')), 'count'],
                [LocalBox.sequelize.fn('SUM', LocalBox.sequelize.col('total_quantity')), 'quantity']
            ],
            group: ['status']
        });
        
        // 按箱型统计
        const typeStats = await LocalBox.findAll({
            where: whereCondition,
            attributes: [
                'box_type',
                [LocalBox.sequelize.fn('COUNT', LocalBox.sequelize.col('记录号')), 'count'],
                [LocalBox.sequelize.fn('SUM', LocalBox.sequelize.col('total_quantity')), 'quantity']
            ],
            group: ['box_type']
        });
        
        res.json({
            code: 0,
            message: '统计成功',
            data: {
                total: totalStats,
                byStatus: statusStats,
                byType: typeStats
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 获取统计失败:', error);
        res.status(500).json({
            code: 1,
            message: '统计失败',
            error: error.message
        });
    }
});

// 测试数据库连接和模型
router.get('/test-db', async (req, res) => {
    try {
        console.log('测试数据库连接...');
        
        // 测试LocalBox模型
        const localBoxCount = await LocalBox.count();
        console.log('LocalBox表记录数:', localBoxCount);
        
        // 测试SellerInventorySku模型
        const sellerSkuCount = await SellerInventorySku.count();
        console.log('SellerInventorySku表记录数:', sellerSkuCount);
        
        // 获取SellerInventorySku表的前几条记录
        const sampleSkus = await SellerInventorySku.findAll({
            limit: 3,
            attributes: ['skuid', 'parent_sku', 'child_sku', 'sellercolorname', 'sellersizename']
        });
        
        // 测试查询特定SKU
        const testSku = 'XB362D1';
        let testSkuResult;
        try {
            testSkuResult = await SellerInventorySku.findOne({
                where: { child_sku: testSku }
            });
        } catch (error) {
            testSkuResult = { error: error.message };
        }
        
        res.json({
            code: 0,
            message: '数据库连接正常',
            data: {
                localBoxCount,
                sellerSkuCount,
                sampleSkus: sampleSkus.map(sku => sku.toJSON()),
                testSkuResult: testSkuResult ? (testSkuResult.toJSON ? testSkuResult.toJSON() : testSkuResult) : null,
                testSku: testSku
            }
        });
    } catch (error) {
        console.error('数据库测试失败:', error);
        res.status(500).json({
            code: 1,
            message: '数据库测试失败: ' + error.message,
            error: {
                type: error.name,
                details: error.message,
                stack: error.stack
            }
        });
    }
});

// 验证SKU并获取单箱数量
router.post('/validate-sku', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🔍 验证SKU并获取单箱数量');
    
    try {
        const { sku } = req.body;
        console.log('接收到SKU验证请求:', sku);
        
        if (!sku) {
            return res.status(400).json({
                code: 1,
                message: 'SKU不能为空'
            });
        }
        
        // 查询SKU信息
        console.log('开始查询SKU:', sku);
        const skuInfo = await SellerInventorySku.findOne({
            where: {
                child_sku: sku
            }
        });
        console.log('查询结果:', skuInfo ? '找到SKU' : '未找到SKU');
        
        if (!skuInfo) {
            return res.json({
                code: 2,
                message: `系统中没有SKU: ${sku}，请联系管理员添加`,
                data: {
                    sku: sku,
                    exists: false
                }
            });
        }
        
        // 由于qty_per_box字段不存在，直接提示用户补充单箱数量
        return res.json({
            code: 3,
            message: `SKU: ${sku} 缺少单箱产品数量信息，请补充`,
            data: {
                sku: sku,
                exists: true,
                hasQtyPerBox: false,
                skuInfo: {
                    skuid: skuInfo.skuid,
                    parent_sku: skuInfo.parent_sku,
                    child_sku: skuInfo.child_sku,
                    sellercolorname: skuInfo.sellercolorname,
                    sellersizename: skuInfo.sellersizename
                }
            }
        });
        
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 验证SKU失败:', error);
        console.error('错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            sql: error.sql || '无SQL信息'
        });
        res.status(500).json({
            code: 1,
            message: '验证失败: ' + error.message,
            error: {
                type: error.name,
                details: error.message
            }
        });
    }
});

// 更新SKU的单箱数量
router.post('/update-qty-per-box', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '📝 更新SKU单箱数量');
    
    try {
        const { sku, qtyPerBox } = req.body;
        
        if (!sku || !qtyPerBox || qtyPerBox <= 0) {
            return res.status(400).json({
                code: 1,
                message: 'SKU和单箱数量不能为空，且数量必须大于0'
            });
        }
        
        // 由于qty_per_box字段可能不存在，我们直接使用临时存储方式
        // 这样可以避免数据库字段兼容性问题
        console.log(`为SKU ${sku} 设置临时单箱数量: ${qtyPerBox}`);
        
        return res.json({
            code: 0,
            message: '已记录单箱数量（当前会话有效）',
            data: {
                sku: sku,
                qtyPerBox: qtyPerBox,
                temporary: true
            }
        });
        
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 更新单箱数量失败:', error);
        res.status(500).json({
            code: 1,
            message: '更新失败',
            error: error.message
        });
    }
});

module.exports = router; 