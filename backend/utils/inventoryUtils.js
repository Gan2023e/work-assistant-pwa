const LocalBox = require('../models/LocalBox');
const { Op } = require('sequelize');

/**
 * 生成新的记录号 - 基于时间串
 * 格式：YYYYMMDDHHMM + 序号
 * 例如：202501031425001, 202501031425002
 */
async function generateRecordId() {
    const now = new Date();
    const timeString = now.getFullYear().toString() +
                      (now.getMonth() + 1).toString().padStart(2, '0') +
                      now.getDate().toString().padStart(2, '0') +
                      now.getHours().toString().padStart(2, '0') +
                      now.getMinutes().toString().padStart(2, '0');
    
    // 查询同分钟内的最大序号
    const existingRecords = await LocalBox.findAll({
        where: {
            记录号: {
                [Op.like]: `${timeString}%`
            }
        },
        attributes: ['记录号'],
        order: [['记录号', 'DESC']],
        limit: 1
    });
    
    let sequence = 1;
    if (existingRecords.length > 0) {
        const lastRecord = existingRecords[0].记录号;
        const lastSequence = parseInt(lastRecord.substring(12));
        if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
        }
    }
    
    return timeString + sequence.toString().padStart(3, '0');
}

/**
 * 创建库存记录
 */
async function createInventoryRecord(data) {
    const recordId = await generateRecordId();
    
    return await LocalBox.create({
        记录号: recordId,
        sku: data.sku,
        total_quantity: data.total_quantity,
        total_boxes: data.total_boxes,
        country: data.country,
        操作员: data.operator || '系统',
        打包员: data.packer,
        mix_box_num: data.mix_box_num || null,
        marketPlace: data.marketplace,
        box_type: data.mix_box_num ? '混合箱' : '整箱',
        status: '待出库',
        time: new Date(),
        last_updated_at: new Date(),
        remark: data.remark || `${new Date().toISOString()} 入库创建`
    });
}

/**
 * 批量创建混合箱记录
 */
async function createMixedBoxRecords(mixedBoxData) {
    const { skus, mixBoxNum, operator, packer, remark } = mixedBoxData;
    const records = [];
    
    for (const skuData of skus) {
        const record = await createInventoryRecord({
            sku: skuData.sku,
            total_quantity: skuData.quantity,
            total_boxes: 1, // 混合箱中每个SKU箱数为1
            country: skuData.country,
            operator: operator,
            packer: packer,
            mix_box_num: mixBoxNum,
            marketplace: skuData.marketplace,
            remark: remark
        });
        records.push(record);
    }
    
    return records;
}

/**
 * 更新库存记录
 */
async function updateInventoryRecord(recordId, updateData, changeNote = '') {
    const updateFields = {
        ...updateData,
        last_updated_at: new Date()
    };
    
    // 添加变更备注
    if (changeNote) {
        const currentRecord = await LocalBox.findByPk(recordId);
        if (currentRecord) {
            const existingRemark = currentRecord.remark || '';
            updateFields.remark = existingRemark + 
                `;\n${new Date().toISOString()} 修改: ${changeNote}`;
        }
    }
    
    const [affectedRows] = await LocalBox.update(updateFields, {
        where: {
            记录号: recordId,
            status: '待出库' // 只能编辑待出库的记录
        }
    });
    
    if (affectedRows === 0) {
        throw new Error('记录不存在或已出库，无法编辑');
    }
    
    return await LocalBox.findByPk(recordId);
}

/**
 * 出库操作 - 更新状态而不删除记录
 */
async function shipInventoryRecords(recordIds, shipmentId, operator = '系统') {
    const result = await LocalBox.update({
        status: '已出库',
        shipped_at: new Date(),
        shipment_id: shipmentId,
        last_updated_at: new Date(),
        remark: LocalBox.sequelize.fn('CONCAT', 
            LocalBox.sequelize.fn('IFNULL', LocalBox.sequelize.col('remark'), ''),
            `;\n${new Date().toISOString()} 出库: 发货单${shipmentId} 操作员:${operator}`
        )
    }, {
        where: {
            记录号: { [Op.in]: recordIds },
            status: '待出库'
        }
    });
    
    return result[0]; // 返回受影响的行数
}

/**
 * 取消出库 - 恢复库存状态
 */
async function cancelShipment(shipmentId, operator = '系统') {
    const result = await LocalBox.update({
        status: '待出库',
        shipped_at: null,
        shipment_id: null,
        last_updated_at: new Date(),
        remark: LocalBox.sequelize.fn('CONCAT', 
            LocalBox.sequelize.fn('IFNULL', LocalBox.sequelize.col('remark'), ''),
            `;\n${new Date().toISOString()} 取消出库: 发货单${shipmentId} 操作员:${operator}`
        )
    }, {
        where: {
            shipment_id: shipmentId,
            status: '已出库'
        }
    });
    
    return result[0];
}

/**
 * 获取未发库存统计
 */
async function getPendingInventory(filters = {}) {
    const whereCondition = {
        status: '待出库'
    };
    
    // 添加筛选条件
    if (filters.sku) {
        whereCondition.sku = { [Op.like]: `%${filters.sku}%` };
    }
    if (filters.country) {
        whereCondition.country = filters.country;
    }
    if (filters.box_type) {
        whereCondition.box_type = filters.box_type;
    }
    
    const inventory = await LocalBox.findAll({
        where: whereCondition,
        attributes: [
            'sku',
            'country',
            [LocalBox.sequelize.fn('SUM', 
                LocalBox.sequelize.literal("CASE WHEN box_type = '整箱' THEN total_quantity ELSE 0 END")
            ), 'whole_box_quantity'],
            [LocalBox.sequelize.fn('SUM', 
                LocalBox.sequelize.literal("CASE WHEN box_type = '整箱' THEN total_boxes ELSE 0 END")
            ), 'whole_box_count'],
            [LocalBox.sequelize.fn('SUM', 
                LocalBox.sequelize.literal("CASE WHEN box_type = '混合箱' THEN total_quantity ELSE 0 END")
            ), 'mixed_box_quantity'],
            [LocalBox.sequelize.fn('COUNT', 
                LocalBox.sequelize.literal("DISTINCT CASE WHEN box_type = '混合箱' THEN mix_box_num END")
            ), 'mixed_box_count'],
            [LocalBox.sequelize.fn('MIN', LocalBox.sequelize.col('time')), 'earliest_inbound'],
            [LocalBox.sequelize.fn('MAX', LocalBox.sequelize.col('last_updated_at')), 'latest_update']
        ],
        group: ['sku', 'country'],
        order: [['sku', 'ASC'], ['country', 'ASC']]
    });
    
    return inventory;
}

/**
 * 获取混合箱详情
 */
async function getMixedBoxDetails(mixBoxNum) {
    return await LocalBox.findAll({
        where: {
            mix_box_num: mixBoxNum,
            status: '待出库'
        },
        order: [['记录号', 'ASC']]
    });
}

/**
 * 生成打印标签数据
 */
function generatePrintLabelData(record) {
    return {
        recordId: record.记录号,
        sku: record.sku,
        quantity: record.total_quantity,
        boxes: record.total_boxes,
        country: record.country,
        operator: record.操作员,
        packer: record.打包员,
        boxType: record.box_type,
        mixBoxNum: record.mix_box_num,
        createTime: record.time,
        barcode: record.记录号,
        qrData: JSON.stringify({
            id: record.记录号,
            sku: record.sku,
            qty: record.total_quantity,
            country: record.country
        })
    };
}

module.exports = {
    generateRecordId,
    createInventoryRecord,
    createMixedBoxRecords,
    updateInventoryRecord,
    shipInventoryRecords,
    cancelShipment,
    getPendingInventory,
    getMixedBoxDetails,
    generatePrintLabelData
}; 