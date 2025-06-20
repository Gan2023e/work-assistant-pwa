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
      'DELETE FROM local_boxes WHERE 记录号 = ?',
      { replacements: [记录号] }
    );
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除失败', error: e.message });
  }
});

module.exports = router;
