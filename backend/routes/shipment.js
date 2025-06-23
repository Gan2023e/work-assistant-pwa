const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const Logistics = require('../models/Logistics');
const AmzWarehouse = require('../models/AmzWarehouse');

// 创建uploads目录（如果不存在）
const uploadsDir = path.join(__dirname, '../uploads/shipments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只允许PDF文件
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF文件'));
    }
  }
});

// 物流商配置
const LOGISTICS_PROVIDERS = {
  '裕盛泰': {
    name: '裕盛泰',
    channels: ['美国盐田海卡', '英国盐田海派'],
    template: 'yushengtai'
  },
  '东方瑞达': {
    name: '东方瑞达',
    channels: ['美国盐田海卡', '英国盐田海派'],
    template: 'dongfangruida'
  }
};

// 获取物流商列表和渠道
router.get('/providers', async (req, res) => {
  try {
    const providers = Object.keys(LOGISTICS_PROVIDERS).map(key => ({
      name: key,
      channels: LOGISTICS_PROVIDERS[key].channels
    }));
    
    res.json({
      code: 0,
      message: '获取成功',
      data: providers
    });
  } catch (error) {
    console.error('获取物流商列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 解析PDF并提取信息
async function parsePDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    // 这里需要根据实际PDF格式来解析信息
    // 以下是示例解析逻辑，需要根据实际情况调整
    const text = data.text;
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const extractedData = {
      packageCount: 0,
      packageNumbers: [],
      products: [],
      destinationWarehouse: '',
      destinationCountry: ''
    };
    
    // 解析箱数信息（示例正则，需要根据实际格式调整）
    const packageMatch = text.match(/(\d+)\s*箱|(\d+)\s*CARTON/i);
    if (packageMatch) {
      extractedData.packageCount = parseInt(packageMatch[1] || packageMatch[2]);
    }
    
    // 解析箱号信息
    const packageNumberMatches = text.match(/箱号[:：]\s*([A-Z0-9\-,\s]+)/i);
    if (packageNumberMatches) {
      extractedData.packageNumbers = packageNumberMatches[1]
        .split(/[,，\s]+/)
        .map(num => num.trim())
        .filter(num => num);
    }
    
    // 解析产品SKU信息
    const skuMatches = text.match(/SKU[:：]\s*([A-Z0-9\-,\s]+)/gi);
    if (skuMatches) {
      skuMatches.forEach(match => {
        const skus = match.replace(/SKU[:：]\s*/i, '')
          .split(/[,，\s]+/)
          .map(sku => sku.trim())
          .filter(sku => sku);
        extractedData.products.push(...skus);
      });
    }
    
    // 解析目的地信息
    const warehouseMatch = text.match(/仓库[:：]\s*([^\n]+)/i);
    if (warehouseMatch) {
      extractedData.destinationWarehouse = warehouseMatch[1].trim();
    }
    
    const countryMatch = text.match(/国家[:：]\s*([^\n]+)/i);
    if (countryMatch) {
      extractedData.destinationCountry = countryMatch[1].trim();
    }
    
    return extractedData;
  } catch (error) {
    console.error('PDF解析失败:', error);
    throw new Error('PDF解析失败: ' + error.message);
  }
}

// 生成Shipping ID
function generateShippingId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const second = now.getSeconds().toString().padStart(2, '0');
  
  return `SH${year}${month}${day}${hour}${minute}${second}`;
}

// 上传PDF并提取信息
router.post('/extract-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '请上传PDF文件'
      });
    }
    
    const extractedData = await parsePDF(req.file.path);
    
    // 删除上传的临时文件
    fs.unlinkSync(req.file.path);
    
    res.json({
      code: 0,
      message: 'PDF解析成功',
      data: extractedData
    });
  } catch (error) {
    console.error('PDF提取失败:', error);
    // 删除上传的临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      code: 1,
      message: 'PDF提取失败',
      error: error.message
    });
  }
});

// 创建新货件
router.post('/', async (req, res) => {
  try {
    const {
      logisticsProvider,
      channel,
      packageCount,
      packageNumbers,
      products,
      destinationWarehouse,
      destinationCountry,
      notes
    } = req.body;
    
    // 生成Shipping ID
    const shippingId = generateShippingId();
    
    // 创建货件记录
    const shipment = await Logistics.create({
      shippingId,
      logisticsProvider,
      channel,
      packageCount: parseInt(packageCount) || 0,
      productCount: products ? products.length : 0,
      destinationWarehouse,
      destinationCountry,
      status: '待发货',
      paymentStatus: '未付',
      taxPaymentStatus: '未付',
      taxDeclarationStatus: '未报',
      notes: notes || `包含产品: ${products ? products.join(', ') : ''}`,
      departureDate: new Date().toISOString().split('T')[0]
    });
    
    res.json({
      code: 0,
      message: '货件创建成功',
      data: {
        shipment,
        packageNumbers,
        products
      }
    });
  } catch (error) {
    console.error('创建货件失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建货件失败',
      error: error.message
    });
  }
});

// 生成发票（下载）
router.post('/generate-invoice', async (req, res) => {
  try {
    const { shippingId, logisticsProvider, invoiceData } = req.body;
    
    // 根据物流商选择不同的发票模板
    const providerConfig = LOGISTICS_PROVIDERS[logisticsProvider];
    if (!providerConfig) {
      return res.status(400).json({
        code: 1,
        message: '不支持的物流商'
      });
    }
    
    // 这里应该根据不同物流商生成不同格式的发票
    // 现在只是返回一个模拟的响应
    const invoiceTemplate = {
      template: providerConfig.template,
      shippingId,
      provider: logisticsProvider,
      data: invoiceData,
      downloadUrl: `/api/shipments/${shippingId}/invoice.pdf`
    };
    
    res.json({
      code: 0,
      message: '发票生成成功',
      data: invoiceTemplate
    });
  } catch (error) {
    console.error('生成发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '生成发票失败',
      error: error.message
    });
  }
});

module.exports = router; 