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
        
        // 处理状态筛选：如果用户明确指定了status，使用指定的status；否则默认排除已出库
        if (status) {
            whereCondition.status = status;
        } else {
            // 默认排除已出库记录
            whereCondition.status = { [Op.ne]: '已出库' };
        }
        
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


// 验证SKU并获取单箱数量
router.post('/validate-sku', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🔍 验证SKU并获取单箱数量');
    
    try {
        const { sku } = req.body;
        
        if (!sku) {
            return res.status(400).json({
                code: 1,
                message: 'SKU不能为空'
            });
        }
        
        // 查询SKU信息
        const skuInfo = await SellerInventorySku.findOne({
            where: {
                child_sku: sku
            }
        });
        
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
        
        // 检查qty_per_box字段值
        const qtyPerBox = skuInfo.qty_per_box;
        
        // 如果qty_per_box为空值、null或0，提示用户补充
        if (!qtyPerBox || qtyPerBox <= 0) {
            return res.json({
                code: 3,
                message: `SKU: ${sku} 缺少单箱产品数量信息，请补充`,
                data: {
                    sku: sku,
                    exists: true,
                    hasQtyPerBox: false,
                    currentQtyPerBox: qtyPerBox,
                    skuInfo: {
                        skuid: skuInfo.skuid,
                        parent_sku: skuInfo.parent_sku,
                        child_sku: skuInfo.child_sku,
                        sellercolorname: skuInfo.sellercolorname,
                        sellersizename: skuInfo.sellersizename
                    }
                }
            });
        }
        
        res.json({
            code: 0,
            message: '验证成功',
            data: {
                sku: sku,
                exists: true,
                hasQtyPerBox: true,
                qtyPerBox: qtyPerBox,
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
        res.status(500).json({
            code: 1,
            message: '验证失败',
            error: error.message
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
        
        // 更新数据库中的qty_per_box字段
        const [affectedRows] = await SellerInventorySku.update({
            qty_per_box: qtyPerBox
        }, {
            where: {
                child_sku: sku
            }
        });
        
        if (affectedRows === 0) {
            return res.status(404).json({
                code: 1,
                message: 'SKU不存在，无法更新'
            });
        }
        
        res.json({
            code: 0,
            message: '单箱数量更新成功',
            data: {
                sku: sku,
                qtyPerBox: qtyPerBox,
                temporary: false
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

// ==================== SKU装箱数量管理接口 ====================

// 获取所有SKU装箱数量配置
router.get('/sku-packaging', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '🔍 获取SKU装箱数量配置');
    
    try {
        const { page = 1, limit = 50, search } = req.query;
        
        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { parent_sku: { [Op.like]: `%${search}%` } },
                { child_sku: { [Op.like]: `%${search}%` } }
            ];
        }
        
        const { count, rows } = await SellerInventorySku.findAndCountAll({
            where: whereClause,
            offset: (page - 1) * limit,
            limit: parseInt(limit),
            order: [['parent_sku', 'ASC'], ['child_sku', 'ASC']]
        });
        
        console.log('\x1b[33m%s\x1b[0m', `📦 查询到 ${count} 个SKU装箱配置`);
        
        res.json({
            code: 0,
            message: '查询成功',
            data: {
                list: rows,
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 获取SKU装箱配置失败:', error);
        res.status(500).json({
            code: 1,
            message: '查询失败',
            error: error.message
        });
    }
});

// 更新单个SKU装箱数量
router.put('/sku-packaging/:skuid', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '✏️ 更新SKU装箱数量');
    
    try {
        const { skuid } = req.params;
        const { qty_per_box } = req.body;
        
        if (!qty_per_box || qty_per_box < 1) {
            return res.status(400).json({
                code: 1,
                message: '装箱数量必须大于0'
            });
        }
        
        const result = await SellerInventorySku.update(
            { qty_per_box: parseInt(qty_per_box) },
            { where: { skuid } }
        );
        
        if (result[0] === 0) {
            return res.status(404).json({
                code: 1,
                message: 'SKU不存在'
            });
        }
        
        console.log('\x1b[33m%s\x1b[0m', `📦 SKU ${skuid} 装箱数量更新为 ${qty_per_box}`);
        
        res.json({
            code: 0,
            message: '更新成功'
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 更新SKU装箱数量失败:', error);
        res.status(500).json({
            code: 1,
            message: '更新失败',
            error: error.message
        });
    }
});

// 批量更新SKU装箱数量
router.put('/sku-packaging/batch', async (req, res) => {
    console.log('\x1b[32m%s\x1b[0m', '📝 批量更新SKU装箱数量');
    console.log('完整请求体:', JSON.stringify(req.body, null, 2));
    
    try {
        const { updates } = req.body; // [{ skuid, qty_per_box }, ...]
        console.log('解析的updates:', JSON.stringify(updates, null, 2));
        
        if (!Array.isArray(updates) || updates.length === 0) {
            console.error('updates验证失败:', { updates, isArray: Array.isArray(updates), length: updates?.length });
            return res.status(400).json({
                code: 1,
                message: '更新数据不能为空'
            });
        }
        
        // 简化验证数据逻辑，skuid作为字符串处理
        for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            console.log(`验证更新项 ${i}:`, JSON.stringify(update, null, 2));
            
            // skuid验证（字符串类型）
            if (!update.skuid && update.skuid !== '0') {
                console.error(`SKU ID 缺失 (项 ${i}):`, update);
                return res.status(400).json({
                    code: 1,
                    message: `第 ${i + 1} 项的SKU ID 不能为空`
                });
            }
            
            // 将skuid转换为字符串确保类型正确
            const skuidStr = String(update.skuid);
            if (!skuidStr || skuidStr.trim() === '') {
                console.error(`SKU ID 无效 (项 ${i}):`, update);
                return res.status(400).json({
                    code: 1,
                    message: `第 ${i + 1} 项的SKU ID 无效`
                });
            }
            
            // qty_per_box验证（数字类型）
            const qtyValue = Number(update.qty_per_box);
            if (!update.qty_per_box && update.qty_per_box !== 0) {
                console.error(`装箱数量缺失 (项 ${i}):`, update);
                return res.status(400).json({
                    code: 1,
                    message: `第 ${i + 1} 项的装箱数量不能为空`
                });
            }
            
            if (qtyValue < 1) {
                console.error(`装箱数量无效 (项 ${i}):`, update, '转换后的值:', qtyValue);
                return res.status(400).json({
                    code: 1,
                    message: `第 ${i + 1} 项的装箱数量必须大于0，当前值：${update.qty_per_box}`
                });
            }
            
            // 更新数组中的数据确保类型正确
            updates[i] = {
                skuid: skuidStr, // 确保是字符串
                qty_per_box: Math.floor(qtyValue) // 确保是整数
            };
        }
        
        console.log('验证通过，准备执行批量更新');
        
        // 检查数据库连接
        await SellerInventorySku.sequelize.authenticate();
        console.log('✅ 数据库连接正常');
        
        // 批量更新，使用与单个更新相同的逻辑
        const updatePromises = updates.map(async (update, index) => {
            try {
                console.log(`执行更新 ${index + 1}:`, { skuid: update.skuid, qty_per_box: update.qty_per_box });
                const result = await SellerInventorySku.update(
                    { qty_per_box: parseInt(update.qty_per_box) }, // 使用parseInt，与单个更新一致
                    { where: { skuid: update.skuid } }
                );
                console.log(`更新结果 ${index + 1}:`, result);
                return result;
            } catch (error) {
                console.error(`更新项 ${index + 1} 失败:`, error);
                throw error;
            }
        });
        
        const results = await Promise.all(updatePromises);
        console.log('批量更新结果:', results);
        
        console.log('\x1b[33m%s\x1b[0m', `📦 批量更新 ${updates.length} 个SKU装箱数量`);
        
        res.json({
            code: 0,
            message: `成功更新 ${updates.length} 个SKU装箱数量`,
            data: results
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 批量更新SKU装箱数量失败:', error);
        console.error('错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            sql: error.sql
        });
        res.status(500).json({
            code: 1,
            message: '批量更新失败',
            error: error.message
        });
    }
});

module.exports = router; 