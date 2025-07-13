const express = require('express');
const router = express.Router();
const { PurchaseOrder, Invoice, sequelize } = require('../models/index');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToOSS, deleteFromOSS, getSignedUrl, checkOSSConfig } = require('../utils/oss');

// 配置文件上传中间件
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许PDF文件
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF文件'));
    }
  }
});

// ==================== 采购订单相关接口 ====================

// 获取采购订单列表
router.get('/orders', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      seller_name, 
      invoice_status, 
      payment_account,
      start_date,
      end_date,
      order_number 
    } = req.query;

    const whereCondition = {};
    
    if (seller_name) {
      whereCondition.seller_name = { [Op.like]: `%${seller_name}%` };
    }
    
    if (invoice_status) {
      whereCondition.invoice_status = invoice_status;
    }
    
    if (payment_account) {
      whereCondition.payment_account = { [Op.like]: `%${payment_account}%` };
    }
    
    if (order_number) {
      whereCondition.order_number = { [Op.like]: `%${order_number}%` };
    }
    
    if (start_date && end_date) {
      whereCondition.order_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where: whereCondition,
      include: [{
        model: Invoice,
        as: 'invoice',
        required: false
      }],
      order: [['order_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        records: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取采购订单列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建采购订单
router.post('/orders', async (req, res) => {
  try {
    const orderData = req.body;
    
    // 检查订单号是否已存在
    const existingOrder = await PurchaseOrder.findOne({
      where: { order_number: orderData.order_number }
    });
    
    if (existingOrder) {
      return res.status(400).json({
        code: 1,
        message: '采购订单号已存在'
      });
    }

    const newOrder = await PurchaseOrder.create(orderData);
    
    res.json({
      code: 0,
      message: '创建成功',
      data: newOrder
    });
  } catch (error) {
    console.error('创建采购订单失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新采购订单
router.put('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const order = await PurchaseOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        code: 1,
        message: '采购订单不存在'
      });
    }
    
    // 如果修改了订单号，检查是否重复
    if (updateData.order_number && updateData.order_number !== order.order_number) {
      const existingOrder = await PurchaseOrder.findOne({
        where: { 
          order_number: updateData.order_number,
          id: { [Op.ne]: id }
        }
      });
      
      if (existingOrder) {
        return res.status(400).json({
          code: 1,
          message: '采购订单号已存在'
        });
      }
    }

    await order.update(updateData);
    
    res.json({
      code: 0,
      message: '更新成功',
      data: order
    });
  } catch (error) {
    console.error('更新采购订单失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除采购订单
router.delete('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await PurchaseOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        code: 1,
        message: '采购订单不存在'
      });
    }
    
    await order.destroy();
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除采购订单失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// ==================== 发票相关接口 ====================

// 获取发票列表
router.get('/invoices', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      seller_name, 
      invoice_number,
      invoice_type,
      status,
      start_date,
      end_date 
    } = req.query;

    const whereCondition = {};
    
    if (seller_name) {
      whereCondition.seller_name = { [Op.like]: `%${seller_name}%` };
    }
    
    if (invoice_number) {
      whereCondition.invoice_number = { [Op.like]: `%${invoice_number}%` };
    }
    
    if (invoice_type) {
      whereCondition.invoice_type = invoice_type;
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    if (start_date && end_date) {
      whereCondition.invoice_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await Invoice.findAndCountAll({
      where: whereCondition,
      include: [{
        model: PurchaseOrder,
        as: 'purchaseOrders',
        required: false
      }],
      order: [['invoice_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        records: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取发票列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建发票
router.post('/invoices', async (req, res) => {
  try {
    const invoiceData = req.body;
    
    // 检查发票号是否已存在
    const existingInvoice = await Invoice.findOne({
      where: { invoice_number: invoiceData.invoice_number }
    });
    
    if (existingInvoice) {
      return res.status(400).json({
        code: 1,
        message: '发票号已存在'
      });
    }

    const newInvoice = await Invoice.create(invoiceData);
    
    res.json({
      code: 0,
      message: '创建成功',
      data: newInvoice
    });
  } catch (error) {
    console.error('创建发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新发票
router.put('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        code: 1,
        message: '发票不存在'
      });
    }
    
    // 如果修改了发票号，检查是否重复
    if (updateData.invoice_number && updateData.invoice_number !== invoice.invoice_number) {
      const existingInvoice = await Invoice.findOne({
        where: { 
          invoice_number: updateData.invoice_number,
          id: { [Op.ne]: id }
        }
      });
      
      if (existingInvoice) {
        return res.status(400).json({
          code: 1,
          message: '发票号已存在'
        });
      }
    }

    await invoice.update(updateData);
    
    res.json({
      code: 0,
      message: '更新成功',
      data: invoice
    });
  } catch (error) {
    console.error('更新发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除发票
router.delete('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        code: 1,
        message: '发票不存在'
      });
    }
    
    // 检查是否有关联的采购订单
    const relatedOrders = await PurchaseOrder.findAll({
      where: { invoice_id: id }
    });
    
    if (relatedOrders.length > 0) {
      return res.status(400).json({
        code: 1,
        message: '该发票有关联的采购订单，不能直接删除'
      });
    }
    
    await invoice.destroy();
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// ==================== 文件上传相关接口 ====================

// 上传发票文件到OSS
router.post('/upload-invoice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '没有上传文件'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整，请联系管理员'
      });
    }

    // 上传采购发票文件到OSS
    const uploadResult = await uploadToOSS(
      req.file.buffer,
      req.file.originalname,
      'purchase'
    );
    
    if (uploadResult.success) {
      res.json({
        code: 0,
        message: '文件上传成功',
        data: {
          filename: uploadResult.originalName,
          size: uploadResult.size,
          url: uploadResult.url,
          objectName: uploadResult.name
        }
      });
    } else {
      throw new Error('上传失败');
    }
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      code: 1,
      message: '文件上传失败',
      error: error.message
    });
  }
});

// 删除OSS文件
router.delete('/delete-invoice-file', async (req, res) => {
  try {
    const { objectName } = req.body;
    
    if (!objectName) {
      return res.status(400).json({
        code: 1,
        message: '请提供要删除的文件名'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整，请联系管理员'
      });
    }

    const deleteResult = await deleteFromOSS(objectName);
    
    if (deleteResult.success) {
      res.json({
        code: 0,
        message: '文件删除成功'
      });
    } else if (deleteResult.error === 'AccessDenied') {
      res.status(403).json({
        code: 1,
        message: '删除权限不足，请联系管理员检查OSS权限配置',
        error: deleteResult.message
      });
    } else {
      throw new Error(deleteResult.message || '删除失败');
    }
  } catch (error) {
    console.error('文件删除失败:', error);
    res.status(500).json({
      code: 1,
      message: '文件删除失败',
      error: error.message
    });
  }
});

// 获取文件签名URL
router.get('/get-signed-url/:objectName', async (req, res) => {
  try {
    const { objectName } = req.params;
    const { expires = 3600 } = req.query;
    
    if (!objectName) {
      return res.status(400).json({
        code: 1,
        message: '请提供文件名'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整，请联系管理员'
      });
    }

    const signedUrlResult = await getSignedUrl(objectName, parseInt(expires));
    
    if (signedUrlResult.success) {
      res.json({
        code: 0,
        message: '获取签名URL成功',
        data: {
          url: signedUrlResult.url,
          expires: expires
        }
      });
    } else {
      throw new Error('获取签名URL失败');
    }
  } catch (error) {
    console.error('获取签名URL失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取签名URL失败',
      error: error.message
    });
  }
});

// ==================== 批量操作接口 ====================

// 批量更新订单开票状态
router.put('/orders/batch-invoice-status', async (req, res) => {
  try {
    const { order_ids, invoice_status, invoice_id } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要更新的订单ID列表'
      });
    }
    
    const updateData = { invoice_status };
    if (invoice_id) {
      updateData.invoice_id = invoice_id;
    }
    
    const [updatedCount] = await PurchaseOrder.update(updateData, {
      where: { id: { [Op.in]: order_ids } }
    });
    
    res.json({
      code: 0,
      message: '批量更新成功',
      data: { updatedCount }
    });
  } catch (error) {
    console.error('批量更新失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量更新失败',
      error: error.message
    });
  }
});

// 批量删除订单
router.delete('/orders/batch', async (req, res) => {
  try {
    const { order_ids } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要删除的订单ID列表'
      });
    }
    
    const deletedCount = await PurchaseOrder.destroy({
      where: { id: { [Op.in]: order_ids } }
    });
    
    res.json({
      code: 0,
      message: '批量删除成功',
      data: { deletedCount }
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量删除失败',
      error: error.message
    });
  }
});

// ==================== 统计相关接口 ====================

// 获取统计数据
router.get('/statistics', async (req, res) => {
  try {
    // 获取基本统计数据
    const [
      totalOrders,
      unpaidOrders,
      partiallyPaidOrders,
      fullyPaidOrders,
      totalInvoices,
      totalAmount,
      unpaidAmount
    ] = await Promise.all([
      PurchaseOrder.count(),
      PurchaseOrder.count({ where: { invoice_status: '未开票' } }),
      PurchaseOrder.count({ where: { invoice_status: '部分开票' } }),
      PurchaseOrder.count({ where: { invoice_status: '已开票' } }),
      Invoice.count(),
      PurchaseOrder.sum('amount') || 0,
      PurchaseOrder.sum('amount', { where: { invoice_status: '未开票' } }) || 0
    ]);

    // 获取各供应商统计
    const supplierStats = await PurchaseOrder.findAll({
      attributes: [
        'seller_name',
        [sequelize.fn('COUNT', sequelize.col('id')), 'order_count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: ['seller_name'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // 获取月度统计
    const monthlyStats = await PurchaseOrder.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('order_date'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'order_count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('order_date'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('order_date'), '%Y-%m'), 'DESC']],
      limit: 12
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        overview: {
          totalOrders,
          unpaidOrders,
          partiallyPaidOrders,
          fullyPaidOrders,
          totalInvoices,
          totalAmount,
          unpaidAmount
        },
        supplierStats,
        monthlyStats
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

module.exports = router; 