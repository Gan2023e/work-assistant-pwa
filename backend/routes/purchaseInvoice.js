const express = require('express');
const router = express.Router();
const { PurchaseOrder, Invoice, sequelize } = require('../models/index');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
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

// PDF发票解析功能 - 优化版本
const parseInvoicePDF = (text) => {
  const result = {
    invoice_number: '',
    invoice_date: '',
    total_amount: '',
    tax_amount: '',
    tax_rate: '',
    seller_name: '',
    buyer_name: '',
    invoice_type: '增值税普通发票'
  };

  try {
    // 预处理文本：去除多余的空白字符，标准化格式
    const cleanText = text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
    
    // 发票号码解析 - 针对发票号码格式优化
    const invoiceNumberPatterns = [
      // 匹配 "发票号码：数字" 格式
      /发票号码[：:\s]*(\d{20,30})/i,
      // 匹配右上角的长数字发票号
      /(\d{20,30})/,
      // 匹配其他可能的发票号格式
      /发票代码[：:\s]*(\d{10,15})[^0-9]*发票号码[：:\s]*(\d{8,30})/i,
      /票据号[：:\s]*(\d{8,30})/i,
      /NO[：:\s]*(\d{8,30})/i,
      /编号[：:\s]*(\d{8,30})/i,
      /发票编号[：:\s]*(\d{8,30})/i,
      /号码[：:\s]*(\d{8,30})/i,
      // 匹配含字母的发票号码
      /(\d{8,20}[A-Z]{1,5})/i
    ];
    
    for (const pattern of invoiceNumberPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        // 取最后一个匹配的数字组合
        const invoiceNumber = match[match.length - 1];
        if (invoiceNumber && invoiceNumber.length >= 15) {
          result.invoice_number = invoiceNumber;
          break;
        }
      }
    }

    // 开票日期解析 - 针对中文日期格式优化
    const datePatterns = [
      // 匹配 "开票日期：YYYY年MM月DD日" 格式
      /开票日期[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)/,
      /开具日期[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)/,
      // 匹配其他日期格式
      /开票日期[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      /开具日期[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      /日期[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      /开票时间[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      // 支持 YYYY-MM-DD 格式
      /(\d{4}-\d{1,2}-\d{1,2})/,
      // 支持 YYYY/MM/DD 格式
      /(\d{4}\/\d{1,2}\/\d{1,2})/,
      // 支持中文日期格式
      /(\d{4}年\d{1,2}月\d{1,2}日)/
    ];
    
    for (const pattern of datePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let dateStr = match[1];
        // 标准化日期格式
        dateStr = dateStr.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\//g, '-');
        if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
          result.invoice_date = dateStr;
          break;
        }
      }
    }

    // 金额解析 - 针对价税合计格式优化
    const amountPatterns = [
      // 最优先匹配 "价税合计（大写）圆整（小写）¥XX.XX" 完整格式 - 这是发票总金额
      /价税合计[^（]*（大写）[^（]*圆整[^（]*（小写）[^¥]*¥\s*([\d,]+\.?\d*)/,
      // 匹配 "价税合计（大写）...（小写）¥XX.XX" 格式，优先匹配最后一个金额（整数）
      /价税合计[^（]*（大写）[^（]*（小写）[^¥]*¥\s*([\d,]+\.00)/,
      // 匹配 "价税合计（小写）¥XX.XX" 格式，优先匹配整数金额
      /价税合计[^¥]*（小写）[^¥]*¥\s*([\d,]+\.00)/,
      /价税合计[^¥]*小写[^¥]*¥\s*([\d,]+\.00)/,
      // 匹配价税合计行且包含"小写"的格式，优先匹配整数
      /价税合计.*小写.*¥\s*([\d,]+\.00)/,
      // 匹配含有"圆整"的价税合计格式
      /价税合计[^¥]*圆整[^¥]*¥\s*([\d,]+\.?\d*)/,
      // 匹配其他价税合计格式（优先级降低）
      /价税合计[^¥]*¥\s*([\d,]+\.?\d*)/,
      // 匹配 "价税合计（大写）...（小写）¥XX.XX" 格式的一般情况
      /价税合计[^（]*（大写）[^（]*（小写）[^¥]*¥\s*([\d,]+\.?\d*)/,
      // 匹配 "价税合计（小写）¥XX.XX" 格式的一般情况
      /价税合计[^¥]*（小写）[^¥]*¥\s*([\d,]+\.?\d*)/,
      /价税合计[^¥]*小写[^¥]*¥\s*([\d,]+\.?\d*)/,
      // 匹配价税合计行且包含"小写"的格式的一般情况
      /价税合计.*小写.*¥\s*([\d,]+\.?\d*)/,
      /合计[（(]大写[）)][^¥]*¥\s*([\d,]+\.?\d*)/,
      /总计[：:\s]*¥\s*([\d,]+\.?\d*)/,
      /金额合计[：:\s]*¥\s*([\d,]+\.?\d*)/,
      /小写[：:\s]*¥\s*([\d,]+\.?\d*)/,
      /金额[：:\s]*¥\s*([\d,]+\.?\d*)/,
      // 匹配数字金额（作为后备）
      /([\d,]+\.\d{2})/
    ];
    
    for (const pattern of amountPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const amount = match[1].replace(/,/g, '');
        console.log('金额匹配结果:', { pattern: pattern.toString(), match: match[1], amount: amount });
        if (parseFloat(amount) > 0) {
          result.total_amount = amount;
          console.log('确定的发票总金额:', amount);
          break;
        }
      }
    }

    // 税额解析 - 针对税额列格式优化
    const taxAmountPatterns = [
      // 匹配合计行的税额 "合计 ¥30.69 ¥0.31"
      /合计[^¥]*¥[^¥]*¥\s*([\d,]+\.?\d*)/,
      // 匹配税额列最后的小数金额（在税率后面）
      /税率[\/征收率]*[^%\d]*\d{1,2}%[^0-9]*(\d+\.\d{2})/,
      /税\s*额[^¥\d]*(\d+\.\d{2})/,
      /税额[^¥\d]*(\d+\.\d{2})/,
      // 匹配¥符号后的税额
      /税额[：:\s]*¥\s*([\d,]+\.?\d*)/,
      /税金[：:\s]*¥\s*([\d,]+\.?\d*)/,
      /增值税[：:\s]*¥\s*([\d,]+\.?\d*)/,
      /税[：:\s]*¥\s*([\d,]+\.?\d*)/,
      // 匹配税额列中的数字
      /税额[^¥\d]*¥?\s*([\d,]+\.?\d*)/,
      /税金[^¥\d]*¥?\s*([\d,]+\.?\d*)/,
      /增值税[^¥\d]*¥?\s*([\d,]+\.?\d*)/,
      // 匹配表格中税额列的数字
      /税\s*额[^¥\d]*¥?\s*([\d,]+\.?\d*)/,
      // 匹配税额的数字格式
      /税额[：:\s]*([\d,]+\.?\d*)/
    ];
    
    for (const pattern of taxAmountPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const taxAmount = match[1].replace(/,/g, '');
        if (parseFloat(taxAmount) >= 0) {
          result.tax_amount = taxAmount;
          break;
        }
      }
    }

    // 税率解析 - 针对税率/征收率列格式优化
    const taxRatePatterns = [
      // 匹配税率/征收率列中的百分数
      /税率[\/征收率]*[^%]*(\d{1,2}%)/,
      /征收率[^%]*(\d{1,2}%)/,
      // 匹配表格中的税率
      /税\s*率[\/征收率]*[^%]*(\d{1,2}%)/,
      // 匹配其他税率格式
      /税率[：:\s]*(\d{1,2}%)/,
      /税率[：:\s]*(\d{1,2}\.\d{1,2}%)/,
      /税率[：:\s]*0\.(\d{2})/,
      /(\d{1,2}%)/,
      /(\d{1,2}\.\d{1,2}%)/
    ];
    
    for (const pattern of taxRatePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let taxRate = match[1];
        // 如果匹配到的是小数形式，转换为百分比
        if (taxRate.match(/^0\.\d{2}$/)) {
          taxRate = (parseFloat(taxRate) * 100).toFixed(0) + '%';
        }
        result.tax_rate = taxRate;
        break;
      }
    }

    // 开票方（销售方）解析 - 针对销售方信息栏优化
    const sellerPatterns = [
      // 最优先匹配 "销售方信息 名称：公司名称" 格式，直到遇到统一社会信用代码或纳税人识别号
      /销售方[^名称]*名称[：:\s]*([^统一社会信用代码纳税人识别号\n\r]*?)(?=统一社会信用代码|纳税人识别号|地址|电话|开户行|账号|$)/,
      // 匹配销售方区域的公司名称（具体匹配有限公司）
      /销售方[^名称]*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?有限公司)/,
      /销售方[^名称]*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?股份有限公司)/,
      /销售方[^名称]*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?公司)/,
      // 匹配 "销售方 名称：公司名称" 格式（没有信息两字）
      /销售方\s*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?有限公司)/,
      /销售方\s*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?股份有限公司)/,
      /销售方\s*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?公司)/,
      // 匹配其他销售方格式
      /销售方[：:\s]*([^纳税人识别号\n\r]+)/,
      /开票方[：:\s]*([^纳税人识别号\n\r]+)/,
      /卖方[：:\s]*([^纳税人识别号\n\r]+)/,
      /收款人[：:\s]*([^纳税人识别号\n\r]+)/
    ];
    
    for (const pattern of sellerPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let companyName = match[1].trim();
        console.log('销售方匹配结果:', { pattern: pattern.toString(), match: match[1], cleanedText: cleanText.substring(0, 200) });
        // 清理公司名称，移除多余的空格和特殊字符，但保留基本的中文、英文、数字、括号
        companyName = companyName.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9（）()]/g, '');
        if (companyName.length > 3 && companyName.includes('公司')) {
          result.seller_name = companyName;
          console.log('确定的销售方（开票方）:', companyName);
          break;
        }
      }
    }

    // 购买方解析 - 针对购买方信息栏优化
    const buyerPatterns = [
      // 最优先匹配 "购买方信息 名称：公司名称" 格式，直到遇到统一社会信用代码或纳税人识别号
      /购买方[^名称]*名称[：:\s]*([^统一社会信用代码纳税人识别号\n\r]*?)(?=统一社会信用代码|纳税人识别号|地址|电话|开户行|账号|$)/,
      // 匹配购买方区域的公司名称（具体匹配有限公司）
      /购买方[^名称]*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?有限公司)/,
      /购买方[^名称]*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?股份有限公司)/,
      /购买方[^名称]*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?公司)/,
      // 匹配 "购买方 名称：公司名称" 格式（没有信息两字）
      /购买方\s*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?有限公司)/,
      /购买方\s*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?股份有限公司)/,
      /购买方\s*名称[：:\s]*([^地址电话开户行账号统一社会信用代码纳税人识别号\n\r]*?公司)/,
      // 匹配其他购买方格式
      /购买方[：:\s]*([^纳税人识别号\n\r]+)/,
      /买方[：:\s]*([^纳税人识别号\n\r]+)/,
      /收票方[：:\s]*([^纳税人识别号\n\r]+)/,
      /付款方[：:\s]*([^纳税人识别号\n\r]+)/
    ];
    
    for (const pattern of buyerPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let companyName = match[1].trim();
        console.log('购买方匹配结果:', { pattern: pattern.toString(), match: match[1], cleanedText: cleanText.substring(0, 200) });
        // 清理公司名称，移除多余的空格和特殊字符，但保留基本的中文、英文、数字、括号
        companyName = companyName.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9（）()]/g, '');
        if (companyName.length > 3 && companyName.includes('公司')) {
          result.buyer_name = companyName;
          console.log('确定的购买方（收票方）:', companyName);
          break;
        }
      }
    }

    // 发票类型智能识别
    if (cleanText.includes('增值税专用发票')) {
      result.invoice_type = '增值税专用发票';
    } else if (cleanText.includes('增值税普通发票')) {
      result.invoice_type = '增值税普通发票';
    } else if (cleanText.includes('普通发票')) {
      result.invoice_type = '增值税普通发票';
    } else if (cleanText.includes('收据')) {
      result.invoice_type = '收据';
    }

    // 数据清理和验证
    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = result[key].trim();
      }
    });

    console.log('PDF解析结果:', result);
    console.log('原始文本片段:', cleanText.substring(0, 500));
    
  } catch (error) {
    console.error('PDF解析错误:', error);
  }

  return result;
};

// 计算解析完整性评分
const calculateCompletenessScore = (invoiceInfo) => {
  const requiredFields = ['invoice_number', 'invoice_date', 'total_amount', 'seller_name'];
  const optionalFields = ['tax_amount', 'tax_rate', 'buyer_name'];
  
  let score = 0;
  let totalWeight = 0;
  
  // 必需字段权重为 3
  requiredFields.forEach(field => {
    totalWeight += 3;
    if (invoiceInfo[field] && invoiceInfo[field].toString().trim()) {
      score += 3;
    }
  });
  
  // 可选字段权重为 1
  optionalFields.forEach(field => {
    totalWeight += 1;
    if (invoiceInfo[field] && invoiceInfo[field].toString().trim()) {
      score += 1;
    }
  });
  
  return Math.round((score / totalWeight) * 100);
};

// 上传并解析PDF发票
router.post('/upload-and-parse-invoice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '没有上传文件'
      });
    }

    // 检查文件类型
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        code: 1,
        message: '只支持PDF文件'
      });
    }

    // 解析PDF内容
    const pdfData = await pdf(req.file.buffer);
    const extractedText = pdfData.text;

    // 从PDF文本中提取发票信息
    const invoiceInfo = parseInvoicePDF(extractedText);

    // 上传文件到OSS
    let uploadResult = null;
    if (checkOSSConfig()) {
      try {
        uploadResult = await uploadToOSS(
          req.file.buffer,
          req.file.originalname,
          'purchase'
        );
      } catch (uploadError) {
        console.warn('OSS上传失败，但PDF解析成功:', uploadError);
      }
    }

    res.json({
      code: 0,
      message: 'PDF解析成功',
      data: {
        extractedInfo: invoiceInfo,
        originalText: extractedText,
        fileInfo: uploadResult ? {
          filename: uploadResult.originalName,
          size: uploadResult.size,
          url: uploadResult.url,
          objectName: uploadResult.name
        } : null,
        // 增加解析质量评估
        parseQuality: {
          hasInvoiceNumber: !!invoiceInfo.invoice_number,
          hasInvoiceDate: !!invoiceInfo.invoice_date,
          hasTotalAmount: !!invoiceInfo.total_amount,
          hasSellerName: !!invoiceInfo.seller_name,
          completeness: calculateCompletenessScore(invoiceInfo)
        }
      }
    });

  } catch (error) {
    console.error('PDF解析失败:', error);
    res.status(500).json({
      code: 1,
      message: 'PDF解析失败',
      error: error.message
    });
  }
});

// 批量关联订单与发票
router.post('/associate-orders-with-invoice', async (req, res) => {
  try {
    const { order_ids, invoice_data } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要关联的订单ID列表'
      });
    }

    if (!invoice_data) {
      return res.status(400).json({
        code: 1,
        message: '请提供发票数据'
      });
    }

    // 开始事务
    const transaction = await sequelize.transaction();
    
    try {
      // 创建发票
      const invoice = await Invoice.create(invoice_data, { transaction });
      
      // 更新订单状态和关联发票
      await PurchaseOrder.update(
        { 
          invoice_status: '已开票', 
          invoice_id: invoice.id 
        },
        { 
          where: { id: { [Op.in]: order_ids } },
          transaction 
        }
      );

      // 提交事务
      await transaction.commit();

      res.json({
        code: 0,
        message: '关联成功',
        data: {
          invoice_id: invoice.id,
          updated_order_count: order_ids.length
        }
      });

    } catch (error) {
      // 回滚事务
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('关联订单与发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '关联失败',
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