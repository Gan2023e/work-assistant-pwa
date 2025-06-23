const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const HsCode = require('../models/HsCode');

// 调试端点：测试删除
router.delete('/debug/test-delete/:parentSku', async (req, res) => {
  try {
    const parentSku = req.params.parentSku;
    console.log('🧪 测试删除功能，parentSku:', parentSku);
    
    // 1. 查看删除前的状态
    const beforeDelete = await HsCode.findByPk(parentSku);
    console.log('删除前记录:', beforeDelete ? beforeDelete.toJSON() : null);
    
    if (!beforeDelete) {
      return res.json({
        code: 1,
        message: '记录不存在',
        data: { parentSku, found: false }
      });
    }
    
    // 2. 尝试使用SQL直接删除
    const sqlResult = await HsCode.sequelize.query(
      'DELETE FROM hscode WHERE parent_sku = ?',
      {
        replacements: [parentSku],
        type: HsCode.sequelize.QueryTypes.DELETE
      }
    );
    console.log('SQL删除结果:', sqlResult);
    
    // 3. 验证删除结果
    const afterDelete = await HsCode.findByPk(parentSku);
    console.log('删除后记录:', afterDelete ? afterDelete.toJSON() : null);
    
    res.json({
      code: 0,
      message: '删除测试完成',
      data: {
        parentSku,
        beforeDelete: beforeDelete ? beforeDelete.toJSON() : null,
        sqlDeleteResult: sqlResult,
        afterDelete: afterDelete ? afterDelete.toJSON() : null,
        deleted: !afterDelete
      }
    });
  } catch (error) {
    console.error('删除测试失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除测试失败',
      error: error.message
    });
  }
});

// 调试端点：创建表
router.post('/debug/create-table', async (req, res) => {
  try {
    // 强制同步表结构
    await HsCode.sync({ force: true });
    
    // 插入示例数据
    await HsCode.bulkCreate([
      {
        parent_sku: 'SKU001',
        weblink: 'https://example.com/product1',
        uk_hscode: '8526920000',
        us_hscode: '8526920000',
        declared_value: 15.50,
        declared_value_currency: 'USD'
      },
      {
        parent_sku: 'SKU002',
        weblink: 'https://example.com/product2',
        uk_hscode: '8471300000',
        us_hscode: '8471300000',
        declared_value: 25.99,
        declared_value_currency: 'USD'
      }
    ], { ignoreDuplicates: true });
    
    res.json({
      code: 0,
      message: '表创建成功并插入示例数据',
      data: {
        created: true
      }
    });
  } catch (error) {
    console.error('创建表失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建表失败',
      error: error.message
    });
  }
});

// 调试端点：检查表状态
router.get('/debug/table-info', async (req, res) => {
  try {
    // 检查表是否存在
    const tableExists = await HsCode.sequelize.getQueryInterface().showAllTables().then(tables => {
      return tables.includes('hscode');
    });
    
    if (!tableExists) {
      return res.json({
        code: 1,
        message: '表不存在',
        data: {
          tableExists: false,
          suggestion: '请运行数据库迁移脚本创建表'
        }
      });
    }
    
    // 获取表结构
    const tableDescription = await HsCode.sequelize.getQueryInterface().describeTable('hscode');
    
    // 统计记录数
    const count = await HsCode.count();
    
    res.json({
      code: 0,
      message: '表信息获取成功',
      data: {
        tableExists: true,
        recordCount: count,
        tableStructure: tableDescription
      }
    });
  } catch (error) {
    console.error('获取表信息失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取表信息失败',
      error: error.message
    });
  }
});

// 获取所有HSCODE
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { parent_sku: { [Op.like]: `%${search}%` } },
        { weblink: { [Op.like]: `%${search}%` } },
        { uk_hscode: { [Op.like]: `%${search}%` } },
        { us_hscode: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const hsCodes = await HsCode.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      code: 0,
      message: '获取成功',
      data: hsCodes
    });
  } catch (error) {
    console.error('获取HSCODE列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 根据parent_sku获取单个HSCODE
router.get('/:parentSku', async (req, res) => {
  try {
    const hsCode = await HsCode.findByPk(req.params.parentSku);
    if (!hsCode) {
      return res.status(404).json({
        code: 1,
        message: 'HSCODE不存在'
      });
    }
    
    res.json({
      code: 0,
      message: '获取成功',
      data: hsCode
    });
  } catch (error) {
    console.error('获取HSCODE详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建新HSCODE
router.post('/', async (req, res) => {
  try {
    const { parent_sku, weblink, uk_hscode, us_hscode, declared_value, declared_value_currency } = req.body;
    
    // 验证必填字段
    if (!parent_sku || !weblink || !uk_hscode || !us_hscode) {
      return res.status(400).json({
        code: 1,
        message: '缺少必填字段'
      });
    }
    
    // 检查parent_sku是否已存在
    const existingHsCode = await HsCode.findByPk(parent_sku);
    if (existingHsCode) {
      return res.status(400).json({
        code: 1,
        message: '该父SKU已存在'
      });
    }
    
    const hsCode = await HsCode.create({
      parent_sku,
      weblink,
      uk_hscode,
      us_hscode,
      declared_value,
      declared_value_currency: declared_value_currency || 'USD'
    });
    
    res.json({
      code: 0,
      message: '创建成功',
      data: hsCode
    });
  } catch (error) {
    console.error('创建HSCODE失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新HSCODE
router.put('/:parentSku', async (req, res) => {
  try {
    const { weblink, uk_hscode, us_hscode, declared_value, declared_value_currency } = req.body;
    
    // 验证必填字段
    if (!weblink || !uk_hscode || !us_hscode) {
      return res.status(400).json({
        code: 1,
        message: '缺少必填字段'
      });
    }
    
    const [updated] = await HsCode.update({
      weblink,
      uk_hscode,
      us_hscode,
      declared_value,
      declared_value_currency,
      updated_at: new Date()
    }, {
      where: { parent_sku: req.params.parentSku }
    });
    
    if (updated) {
      const hsCode = await HsCode.findByPk(req.params.parentSku);
      res.json({
        code: 0,
        message: '更新成功',
        data: hsCode
      });
    } else {
      res.status(404).json({
        code: 1,
        message: 'HSCODE不存在'
      });
    }
  } catch (error) {
    console.error('更新HSCODE失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除HSCODE
router.delete('/:parentSku', async (req, res) => {
  try {
    const parentSku = req.params.parentSku;
    console.log('🗑️ 接收到删除请求，parentSku:', parentSku);
    
    // 检查记录是否存在
    const hsCode = await HsCode.findByPk(parentSku);
    console.log('📍 查找记录结果:', hsCode ? '找到记录' : '记录不存在');
    
    if (!hsCode) {
      console.log('❌ 记录不存在，parentSku:', parentSku);
      return res.status(404).json({
        code: 1,
        message: `HSCODE记录不存在: ${parentSku}`
      });
    }
    
    console.log('🔍 找到要删除的记录:', {
      parent_sku: hsCode.parent_sku,
      weblink: hsCode.weblink,
      uk_hscode: hsCode.uk_hscode,
      us_hscode: hsCode.us_hscode
    });
    
    // 执行删除
    const deleteResult = await hsCode.destroy();
    console.log('🗑️ 删除操作结果:', deleteResult);
    
    // 验证删除是否成功
    const verifyDeleted = await HsCode.findByPk(parentSku);
    console.log('✅ 删除验证:', verifyDeleted ? '删除失败，记录仍存在' : '删除成功');
    
    if (verifyDeleted) {
      throw new Error('删除操作执行后记录仍然存在');
    }
    
    res.json({
      code: 0,
      message: '删除成功',
      data: {
        deletedParentSku: parentSku
      }
    });
  } catch (error) {
    console.error('❌ 删除HSCODE失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message,
      details: {
        errorName: error.name,
        parentSku: req.params.parentSku
      }
    });
  }
});

// 批量创建HSCODE
router.post('/batch', async (req, res) => {
  try {
    const { hsCodes } = req.body;
    
    if (!Array.isArray(hsCodes) || hsCodes.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供有效的HSCODE数据数组'
      });
    }
    
    // 验证数据格式
    for (const hsCode of hsCodes) {
      if (!hsCode.parent_sku || !hsCode.weblink || !hsCode.uk_hscode || !hsCode.us_hscode) {
        return res.status(400).json({
          code: 1,
          message: '每条记录都需要包含parent_sku、weblink、uk_hscode、us_hscode字段'
        });
      }
      // 设置默认货币
      if (hsCode.declared_value && !hsCode.declared_value_currency) {
        hsCode.declared_value_currency = 'USD';
      }
    }
    
    const createdHsCodes = await HsCode.bulkCreate(hsCodes, {
      ignoreDuplicates: true,
      returning: true
    });
    
    res.json({
      code: 0,
      message: `成功创建${createdHsCodes.length}条记录`,
      data: createdHsCodes
    });
  } catch (error) {
    console.error('批量创建HSCODE失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量创建失败',
      error: error.message
    });
  }
});

module.exports = router; 