const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const LocalBox = require('../models/LocalBox');
const PackagePrice = require('../models/PackagePrice');
const { sequelize } = require('../models');

// 获取临工工资结算数据
router.post('/list', async (req, res) => {
  try {
    const { packer, startDate, endDate } = req.body || {};

    // 查询local_boxes
    const where = {};
    if (packer) where['打包员'] = packer;
    if (startDate && endDate) {
      where.time = { [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59'] };
    }
    where.total_quantity = { [Op.gt]: 0 };

    const boxes = await LocalBox.findAll({ where, raw: true });

    // 查询所有相关sku的单价
    const skus = [...new Set(boxes.map(b => b.sku))];
    const [sqlResults] = skus.length > 0
      ? await sequelize.query(
          `SELECT * FROM pbi_package_price WHERE sku IN (${skus.map(s => `'${s}'`).join(',')})`
        )
      : [[]];
    // 组装单价映射
    const priceMap = {};
    for (const p of sqlResults) {
      if (!priceMap[p.sku]) priceMap[p.sku] = {};
      priceMap[p.sku][p.type] = p.price;
    }

    // 为每条数据加上打包单价
    const data = boxes.map(b => {
      let price = null;
      if (priceMap[b.sku]) {
        if (b['打包员'] === '老张' && priceMap[b.sku]['特殊价'] !== undefined) {
          price = priceMap[b.sku]['特殊价'];
        } else if (priceMap[b.sku]['一般价'] !== undefined) {
          price = priceMap[b.sku]['一般价'];
        }
      }
      return { ...b, 打包单价: price };
    });

    res.json({
      code: 0,
      data
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '服务器错误', error: e.message });
  }
});

// 获取所有打包员去重列表
router.get('/packers', async (req, res) => {
  try {
    const [results] = await sequelize.query('SELECT DISTINCT `打包员` FROM local_boxes WHERE `打包员` IS NOT NULL AND `打包员` != ""');
    const packers = results.map(r => r['打包员']).filter(Boolean);
    res.json({ code: 0, data: packers });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取打包员失败', error: e.message });
  }
});

// 新增临时工工资录入接口
router.post('/record_wage', async (req, res) => {
  try {
    const { name, wage } = req.body;
    if (!name || wage === undefined) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }
    // 插入时 return 字段默认为"否"，time为当前时间
    const [result] = await sequelize.query(
      "INSERT INTO temp_worker_wages (name, wage, `return`, time) VALUES (?, ?, '否', NOW())",
      { replacements: [name, wage] }
    );
    res.json({ code: 0, message: '录入成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '录入失败', error: e.message });
  }
});

// 获取未报销工资记录
router.get('/unreimbursed_wages', async (req, res) => {
  try {
    const [results] = await sequelize.query(
      "SELECT * FROM temp_worker_wages WHERE `return` = '否' ORDER BY time DESC"
    );
    res.json({ code: 0, data: results });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取未报销工资失败', error: e.message });
  }
});

// 批量删除工资记录
router.post('/delete_wages', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }
    await sequelize.query(
      `DELETE FROM temp_worker_wages WHERE id IN (${ids.map(() => '?').join(',')})`,
      { replacements: ids }
    );
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除失败', error: e.message });
  }
});

// 批量标记已报销
router.post('/mark_reimbursed', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }
    await sequelize.query(
      `UPDATE temp_worker_wages SET \`return\` = '是' WHERE id IN (${ids.map(() => '?').join(',')})`,
      { replacements: ids }
    );
    res.json({ code: 0, message: '标记成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '标记失败', error: e.message });
  }
});

// 修改打包记录接口
router.post('/update_box_record', async (req, res) => {
  try {
    const { 记录号, 打包员, country, sku, total_boxes, total_quantity } = req.body;
    if (!记录号) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }
    await sequelize.query(
      `UPDATE local_boxes SET 打包员 = ?, country = ?, sku = ?, total_boxes = ?, total_quantity = ? WHERE 记录号 = ?`,
      { replacements: [打包员, country, sku, total_boxes, total_quantity, 记录号] }
    );
    res.json({ code: 0, message: '修改成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '修改失败', error: e.message });
  }
});

// 删除打包记录接口
router.post('/delete_box_record', async (req, res) => {
  try {
    const { 记录号 } = req.body;
    if (!记录号) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }
    await sequelize.query(
      `UPDATE local_boxes SET 
         status = '已取消',
         last_updated_at = NOW(),
         remark = CONCAT(IFNULL(remark, ''), ';
', NOW(), ' 工资管理模块删除')
       WHERE 记录号 = ? AND status = '待出库'`,
      { replacements: [记录号] }
    );
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除失败', error: e.message });
  }
});

// ==================== SKU打包单价管理接口 ====================

// 获取所有SKU打包单价配置
router.get('/package-prices', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 获取SKU打包单价配置');
  
  try {
    const { page = 1, limit = 50, search, type } = req.query;
    
    const whereClause = {};
    if (search) {
      whereClause.sku = { [Op.like]: `%${search}%` };
    }
    if (type) {
      whereClause.type = type;
    }
    
    const { count, rows } = await PackagePrice.findAndCountAll({
      where: whereClause,
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['sku', 'ASC'], ['type', 'ASC']]
    });
    
    // 按SKU分组数据，便于前端展示
    const groupedData = {};
    rows.forEach(row => {
      if (!groupedData[row.sku]) {
        groupedData[row.sku] = { sku: row.sku };
      }
      groupedData[row.sku][row.type] = row.price;
      groupedData[row.sku][`${row.type}_time`] = row.time;
    });
    
    const list = Object.values(groupedData);
    
    console.log('\x1b[33m%s\x1b[0m', `💰 查询到 ${list.length} 个SKU单价配置`);
    
    res.json({
      code: 0,
      message: '查询成功',
      data: {
        list,
        total: list.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(list.length / limit)
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取SKU单价配置失败:', error);
    res.status(500).json({
      code: 1,
      message: '查询失败',
      error: error.message
    });
  }
});

// 更新SKU打包单价
router.put('/package-prices', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '✏️ 更新SKU打包单价');
  
  try {
    const { sku, type, price } = req.body;
    
    if (!sku || !type || !price) {
      return res.status(400).json({
        code: 1,
        message: 'SKU、价格类型和单价都不能为空'
      });
    }
    
    if (price <= 0) {
      return res.status(400).json({
        code: 1,
        message: '单价必须大于0'
      });
    }
    
    if (!['一般价', '特殊价'].includes(type)) {
      return res.status(400).json({
        code: 1,
        message: '价格类型必须是"一般价"或"特殊价"'
      });
    }
    
    // 使用upsert插入或更新
    const [record, created] = await PackagePrice.upsert({
      sku,
      type,
      price: parseFloat(price),
      time: new Date()
    });
    
    console.log('\x1b[33m%s\x1b[0m', `💰 SKU ${sku} ${type} ${created ? '新增' : '更新'}为 ${price}`);
    
    res.json({
      code: 0,
      message: created ? '新增成功' : '更新成功'
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 更新SKU单价失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 批量更新SKU打包单价
router.put('/package-prices/batch', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📝 批量更新SKU打包单价');
  
  try {
    const { updates } = req.body; // [{ sku, type, price }, ...]
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '更新数据不能为空'
      });
    }
    
    // 验证数据
    for (const update of updates) {
      if (!update.sku || !update.type || !update.price) {
        return res.status(400).json({
          code: 1,
          message: 'SKU、价格类型和单价都不能为空'
        });
      }
      
      if (update.price <= 0) {
        return res.status(400).json({
          code: 1,
          message: '单价必须大于0'
        });
      }
      
      if (!['一般价', '特殊价'].includes(update.type)) {
        return res.status(400).json({
          code: 1,
          message: '价格类型必须是"一般价"或"特殊价"'
        });
      }
    }
    
    // 批量更新
    const updatePromises = updates.map(update =>
      PackagePrice.upsert({
        sku: update.sku,
        type: update.type,
        price: parseFloat(update.price),
        time: new Date()
      })
    );
    
    await Promise.all(updatePromises);
    
    console.log('\x1b[33m%s\x1b[0m', `💰 批量更新 ${updates.length} 个SKU单价`);
    
    res.json({
      code: 0,
      message: `成功更新 ${updates.length} 个SKU单价`
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量更新SKU单价失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量更新失败',
      error: error.message
    });
  }
});

// 删除SKU打包单价
router.delete('/package-prices', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🗑️ 删除SKU打包单价');
  
  try {
    const { sku, type } = req.body;
    
    if (!sku || !type) {
      return res.status(400).json({
        code: 1,
        message: 'SKU和价格类型不能为空'
      });
    }
    
    const result = await PackagePrice.destroy({
      where: { sku, type }
    });
    
    if (result === 0) {
      return res.status(404).json({
        code: 1,
        message: '未找到对应的单价配置'
      });
    }
    
    console.log('\x1b[33m%s\x1b[0m', `💰 删除SKU ${sku} ${type}单价配置`);
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 删除SKU单价失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 获取所有唯一SKU列表
router.get('/skus', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 获取所有SKU列表');
  
  try {
    const [results] = await sequelize.query(`
      SELECT DISTINCT sku FROM (
        SELECT DISTINCT sku FROM local_boxes WHERE sku IS NOT NULL
        UNION
        SELECT DISTINCT child_sku as sku FROM sellerinventory_sku WHERE child_sku IS NOT NULL
        UNION
        SELECT DISTINCT sku FROM pbi_package_price WHERE sku IS NOT NULL
      ) AS all_skus 
      ORDER BY sku
    `);
    
    const skus = results.map(row => row.sku);
    
    console.log('\x1b[33m%s\x1b[0m', `📦 查询到 ${skus.length} 个唯一SKU`);
    
    res.json({
      code: 0,
      message: '查询成功',
      data: skus
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取SKU列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '查询失败',
      error: error.message
    });
  }
});

module.exports = router;
