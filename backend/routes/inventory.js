const express = require('express');
const router = express.Router();
const LocalBox = require('../models/LocalBox');
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
        
        console.log('\x1b[36m%s\x1b[0m', '📡 查询参数:', { sku, country, mix_box_num, box_type, status, page, limit });
        
        const whereCondition = {};
        if (sku) whereCondition.sku = { [Op.like]: `%${sku}%` };
        if (country) whereCondition.country = country;
        
        // 处理mix_box_num - 直接字符串匹配（数据库中存储为varchar）
        if (mix_box_num) {
            console.log('\x1b[35m%s\x1b[0m', '🔍 原始mix_box_num:', mix_box_num, '类型:', typeof mix_box_num);
            // 确保作为字符串进行精确匹配
            whereCondition.mix_box_num = mix_box_num.toString().trim();
            console.log('\x1b[35m%s\x1b[0m', '🔍 构建的mix_box_num条件:', whereCondition.mix_box_num);
        }
        
        if (box_type && !mix_box_num) { // 只有在没有指定mix_box_num时才处理box_type
            if (box_type === '整箱') {
                whereCondition.mix_box_num = { [Op.is]: null };
            } else if (box_type === '混合箱') {
                whereCondition.mix_box_num = { [Op.not]: null };
            }
        }
        if (status) whereCondition.status = status;
        
        console.log('\x1b[36m%s\x1b[0m', '🔍 构建的查询条件:', JSON.stringify(whereCondition, null, 2));
        
        const offset = (page - 1) * limit;
        
        console.log('\x1b[35m%s\x1b[0m', '🔍 执行数据库查询，最终条件:', JSON.stringify(whereCondition, null, 2));
        
        const { count, rows } = await LocalBox.findAndCountAll({
            where: whereCondition,
            order: [['last_updated_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });
        
        console.log('\x1b[33m%s\x1b[0m', `📋 查询到 ${count} 条库存记录`);
        
        // 如果是查询特定混合箱号，添加额外调试信息
        if (mix_box_num) {
            console.log('\x1b[35m%s\x1b[0m', '🔍 混合箱查询结果样本:', rows.slice(0, 3).map(r => ({
                id: r.记录号,
                sku: r.sku,
                mix_box_num: r.mix_box_num,
                mix_box_num_type: typeof r.mix_box_num,
                country: r.country
            })));
        }
        
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
        
        // 软删除：更新为已取消状态
        await updateInventoryRecord(recordId, 
            { status: '已取消' }, 
            `删除原因: ${reason || '用户删除'}`
        );
        
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

module.exports = router; 