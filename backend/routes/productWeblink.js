const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ProductWeblink = require('../models/ProductWeblink');
const SellerInventorySku = require('../models/SellerInventorySku');
const multer = require('multer');
const xlsx = require('xlsx');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 搜索功能（原有）
router.post('/search', async (req, res) => {
  try {
    const { keywords } = req.body;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.json({ data: [] });
    }

    // 构建模糊查询条件
    const orConditions = keywords.map(keyword => ({
      [Op.or]: [
        { parent_sku: { [Op.like]: `%${keyword}%` } },
        { weblink: { [Op.like]: `%${keyword}%` } }
      ]
    }));

    const result = await ProductWeblink.findAll({
      where: {
        [Op.or]: orConditions
      },
      attributes: [
        'id',
        'parent_sku',
        'weblink',
        'update_time',
        'check_time',
        'status',
        'notice',
        'cpc_recommend',
        'cpc_status',
        'cpc_submit',
        'model_number',
        'recommend_age',
        'ads_add',
        'list_parent_sku',
        'no_inventory_rate',
        'sales_30days',
        'seller_name'
      ]
    });

    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量更新状态
router.post('/batch-update-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要更新的记录' });
    }

    await ProductWeblink.update(
      { status },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

    res.json({ message: '批量更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量删除
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要删除的记录' });
    }

    await ProductWeblink.destroy({
      where: {
        id: { [Op.in]: ids }
      }
    });

    res.json({ message: '批量删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新单个记录
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    await ProductWeblink.update(updateData, {
      where: { id }
    });

    res.json({ message: '更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 钉钉通知函数
async function sendDingTalkNotification(newProductCount) {
  try {
    const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
    const SECRET_KEY = process.env.SECRET_KEY;
    const MOBILE_NUM_GERRY = process.env.MOBILE_NUM_GERRY;
    
    if (!DINGTALK_WEBHOOK) {
      console.log('钉钉Webhook未配置，跳过通知');
      return;
    }

    // 如果有SECRET_KEY，计算签名
    let webhookUrl = DINGTALK_WEBHOOK;
    if (SECRET_KEY) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${SECRET_KEY}`;
      const sign = crypto.createHmac('sha256', SECRET_KEY)
                        .update(stringToSign)
                        .digest('base64');
      
      // 添加时间戳和签名参数
      const urlObj = new URL(DINGTALK_WEBHOOK);
      urlObj.searchParams.append('timestamp', timestamp.toString());
      urlObj.searchParams.append('sign', encodeURIComponent(sign));
      webhookUrl = urlObj.toString();
    }

    // 使用配置的手机号，如果没有配置则使用默认值
    const mobileNumber = MOBILE_NUM_GERRY || '18676689673';

    const message = {
      msgtype: 'text',
      text: {
        content: `有${newProductCount}款新品上传数据库，需要先审核再批图！@${mobileNumber}`
      },
      at: {
        atMobiles: [mobileNumber],
        isAtAll: false
      }
    };

    const response = await axios.post(webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (response.data.errcode === 0) {
      console.log('钉钉通知发送成功');
    } else {
      console.error('钉钉通知发送失败:', response.data);
    }
  } catch (error) {
    console.error('发送钉钉通知时出错:', error.message);
  }
}

// 生成SKU的函数
function generateSKU() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let sku = '';
  // 前3个字符是字母
  for (let i = 0; i < 3; i++) {
    sku += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // 后3个字符是数字
  for (let i = 0; i < 3; i++) {
    sku += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return sku;
}

// Excel文件上传（原有的）
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择Excel文件' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const newRecords = [];
    
    // 跳过表头，从第二行开始处理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[0].trim()) { // A列有产品链接
        const weblink = row[0].trim();
        
        // 检查是否已存在
        const existing = await ProductWeblink.findOne({
          where: { weblink }
        });
        
        if (!existing) {
          let parent_sku;
          do {
            parent_sku = generateSKU();
            // 确保生成的SKU不重复
            const skuExists = await ProductWeblink.findOne({
              where: { parent_sku }
            });
            if (!skuExists) break;
          } while (true);

          newRecords.push({
            parent_sku,
            weblink,
            update_time: new Date(),
            status: '待处理'
          });
        }
      }
    }

    if (newRecords.length > 0) {
      await ProductWeblink.bulkCreate(newRecords);
      res.json({ 
        message: `成功上传 ${newRecords.length} 条新记录`,
        count: newRecords.length 
      });
    } else {
      res.json({ 
        message: '没有找到新的产品链接',
        count: 0 
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '文件上传失败: ' + err.message });
  }
});

// 新的Excel上传（支持SKU, 链接, 备注）
router.post('/upload-excel-new', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择Excel文件' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const newRecords = [];
    const errors = [];
    
    // 从第一行开始处理（无表头）
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[0].toString().trim()) { // A列有SKU
        const parent_sku = row[0].toString().trim();
        const weblink = row[1] ? row[1].toString().trim() : '';
        const notice = row[2] ? row[2].toString().trim() : '';
        
        // 检查SKU是否已存在
        const existing = await ProductWeblink.findOne({
          where: { parent_sku }
        });
        
        if (existing) {
          errors.push(`第${i+1}行：SKU ${parent_sku} 已存在`);
          continue;
        }

        // 检查链接是否已存在（如果有链接的话）
        if (weblink) {
          const existingLink = await ProductWeblink.findOne({
            where: { weblink }
          });
          
          if (existingLink) {
            errors.push(`第${i+1}行：链接已存在于SKU ${existingLink.parent_sku}`);
            continue;
          }
        }

        newRecords.push({
          parent_sku,
          weblink,
          notice,
          update_time: new Date(),
          status: '待审核'
        });
      }
    }

    let resultMessage = '';
    if (newRecords.length > 0) {
      await ProductWeblink.bulkCreate(newRecords);
      resultMessage = `成功上传 ${newRecords.length} 条新记录`;
      
      // 发送钉钉通知
      try {
        await sendDingTalkNotification(newRecords.length);
      } catch (notificationError) {
        console.error('钉钉通知发送失败，但不影响数据保存:', notificationError.message);
      }
    } else {
      resultMessage = '没有找到有效的数据行';
    }

    if (errors.length > 0) {
      resultMessage += `\n跳过的记录：\n${errors.join('\n')}`;
    }

    res.json({ 
      message: resultMessage,
      count: newRecords.length,
      errors: errors
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '文件上传失败: ' + err.message });
  }
});

// SKU最新编号查询
router.post('/latest-sku', async (req, res) => {
  try {
    const { prefix } = req.body;
    if (!prefix || prefix.trim() === '') {
      return res.status(400).json({ message: '请提供SKU前缀' });
    }

    const trimmedPrefix = prefix.trim();
    
    // 使用正则表达式精确匹配：前缀 + 数字
    // 例如：XB001, XB002, ... XB999，但不包括XBC001
    const result = await ProductWeblink.findOne({
      where: {
        parent_sku: {
          [Op.regexp]: `^${trimmedPrefix}[0-9]+$`
        }
      },
      order: [['parent_sku', 'DESC']],
      attributes: ['parent_sku']
    });

    res.json({ 
      latestSku: result ? result.parent_sku : '未找到该前缀的SKU'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '查询失败: ' + err.message });
  }
});

// 筛选数据接口
router.post('/filter', async (req, res) => {
  try {
    const { status, cpc_status, seller_name } = req.body;
    
    // 构建查询条件
    const whereConditions = {};
    if (status) {
      whereConditions.status = status;
    }
    if (cpc_status) {
      whereConditions.cpc_status = cpc_status;
    }
    if (seller_name) {
      whereConditions.seller_name = { [Op.like]: `%${seller_name}%` };
    }

    const result = await ProductWeblink.findAll({
      where: whereConditions,
      attributes: [
        'id',
        'parent_sku',
        'weblink',
        'update_time',
        'check_time',
        'status',
        'notice',
        'cpc_recommend',
        'cpc_status',
        'cpc_submit',
        'model_number',
        'recommend_age',
        'ads_add',
        'list_parent_sku',
        'no_inventory_rate',
        'sales_30days',
        'seller_name'
      ]
    });

    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '筛选失败' });
  }
});

// 获取全部数据统计信息
router.get('/statistics', async (req, res) => {
  try {
    // 获取状态统计
    const statusStats = await ProductWeblink.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        status: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['status'],
      raw: true
    });

    // 获取CPC状态统计
    const cpcStatusStats = await ProductWeblink.findAll({
      attributes: [
        'cpc_status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        cpc_status: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['cpc_status'],
      raw: true
    });

    // 获取供应商统计
    const supplierStats = await ProductWeblink.findAll({
      attributes: [
        'seller_name',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        seller_name: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['seller_name'],
      raw: true
    });

    // 计算特定状态的产品数量
    const waitingPImageCount = await ProductWeblink.count({
      where: { status: '待P图' }
    });

    const waitingUploadCount = await ProductWeblink.count({
      where: { status: '待上传' }
    });

    res.json({
      statistics: {
        waitingPImage: waitingPImageCount,
        waitingUpload: waitingUploadCount
      },
      statusStats: statusStats.map(item => ({
        value: item.status,
        count: parseInt(item.count)
      })),
      cpcStatusStats: cpcStatusStats.map(item => ({
        value: item.cpc_status,
        count: parseInt(item.count)
      })),
      supplierStats: supplierStats.map(item => ({
        value: item.seller_name,
        count: parseInt(item.count)
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取统计信息失败: ' + err.message });
  }
});

// 子SKU生成器接口
router.post('/child-sku-generator', upload.single('file'), async (req, res) => {
  try {
    const { parentSkus } = req.body;
    console.log('🔍 子SKU生成器请求开始');
    console.log('📄 接收到的parentSkus:', parentSkus);
    console.log('📁 接收到的文件:', req.file ? req.file.originalname : '无文件');
    
    if (!req.file) {
      console.log('❌ 错误: 未接收到文件');
      return res.status(400).json({ message: '请上传Excel文件' });
    }

    if (!parentSkus || parentSkus.trim() === '') {
      console.log('❌ 错误: 未输入SKU');
      return res.status(400).json({ message: '请输入需要整理的SKU' });
    }

    // 解析输入的SKU列表
    const skuList = parentSkus
      .split('\n')
      .map(sku => sku.trim())
      .filter(Boolean);

    console.log('📋 解析后的SKU列表:', skuList);

    if (skuList.length === 0) {
      console.log('❌ 错误: SKU列表为空');
      return res.status(400).json({ message: '请输入有效的SKU' });
    }

    // 读取Excel文件
    console.log('📖 开始读取Excel文件');
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    console.log('📊 工作表名称:', workbook.SheetNames);
    
    // 查找Template页面
    if (!workbook.SheetNames.includes('Template')) {
      console.log('❌ 错误: 未找到Template页面');
      return res.status(400).json({ message: 'Excel文件中未找到Template页面' });
    }

    const worksheet = workbook.Sheets['Template'];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('📋 读取到的数据行数:', data.length);
    console.log('📋 前3行数据:', data.slice(0, 3));

    if (data.length < 3) {
      console.log('❌ 错误: 数据行数不足');
      return res.status(400).json({ message: 'Template页面至少需要3行数据（包含表头）' });
    }

    // 查找第三行中列的位置
    const headerRow = data[2]; // 第三行（索引2）
    console.log('📋 第三行表头数据:', headerRow);
    let itemSkuCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;

    for (let i = 0; i < headerRow.length; i++) {
      const cellValue = headerRow[i]?.toString().toLowerCase();
      console.log(`列 ${i}: "${headerRow[i]}" -> "${cellValue}"`);
      if (cellValue === 'item_sku') {
        itemSkuCol = i;
      } else if (cellValue === 'color_name') {
        colorNameCol = i;
      } else if (cellValue === 'size_name') {
        sizeNameCol = i;
      }
    }

    console.log('🔍 找到的列位置:');
    console.log(`  item_sku列: ${itemSkuCol}`);
    console.log(`  color_name列: ${colorNameCol}`);
    console.log(`  size_name列: ${sizeNameCol}`);

    if (itemSkuCol === -1 || colorNameCol === -1 || sizeNameCol === -1) {
      console.log('❌ 错误: 未找到必需的列');
      return res.status(400).json({ 
        message: '在第三行中未找到必需的列：item_sku、color_name、size_name' 
      });
    }

    // 从数据库查询子SKU信息
    console.log('🔍 开始查询数据库...');
    const inventorySkus = await SellerInventorySku.findAll({
      where: {
        parent_sku: {
          [Op.in]: skuList
        }
      }
    });

    console.log(`📊 查询到 ${inventorySkus.length} 条子SKU记录`);
    if (inventorySkus.length > 0) {
      console.log('📋 前几条记录:');
      inventorySkus.slice(0, 3).forEach((sku, index) => {
        console.log(`  ${index + 1}. parent_sku: ${sku.parent_sku}, child_sku: ${sku.child_sku}, color: ${sku.sellercolorname}, size: ${sku.sellersizename}`);
      });
    }

    if (inventorySkus.length === 0) {
      console.log('❌ 错误: 未找到匹配的子SKU信息');
      return res.status(404).json({ 
        message: '在数据库中未找到匹配的子SKU信息' 
      });
    }

    // 确保数据数组有足够的行数
    while (data.length < 4 + inventorySkus.length) {
      data.push([]);
    }

    // 填充数据（从第4行开始，索引3）
    console.log('📝 开始填充数据...');
    inventorySkus.forEach((sku, index) => {
      const rowIndex = 3 + index; // 第4行开始
      console.log(`📝 处理第 ${rowIndex + 1} 行，SKU: ${sku.parent_sku} -> ${sku.child_sku}`);
      
      // 确保行存在
      if (!data[rowIndex]) {
        data[rowIndex] = [];
      }
      
      // 确保行有足够的列
      const maxCol = Math.max(itemSkuCol, colorNameCol, sizeNameCol);
      while (data[rowIndex].length <= maxCol) {
        data[rowIndex].push('');
      }
      
      // 填充数据
      const itemSkuValue = `UK${sku.child_sku}`;
      const colorValue = sku.sellercolorname || '';
      const sizeValue = sku.sellersizename || '';
      
      data[rowIndex][itemSkuCol] = itemSkuValue;
      data[rowIndex][colorNameCol] = colorValue;
      data[rowIndex][sizeNameCol] = sizeValue;
      
      console.log(`  列 ${itemSkuCol} (item_sku): "${itemSkuValue}"`);
      console.log(`  列 ${colorNameCol} (color_name): "${colorValue}"`);
      console.log(`  列 ${sizeNameCol} (size_name): "${sizeValue}"`);
    });

    console.log(`📝 数据填充完成，总共处理 ${inventorySkus.length} 行`);
    console.log('📋 填充后的前几行数据:');
    data.slice(3, 6).forEach((row, index) => {
      console.log(`  第 ${index + 4} 行:`, row);
    });

    // 重新创建工作表
    console.log('📊 重新创建工作表...');
    const newWorksheet = xlsx.utils.aoa_to_sheet(data);
    workbook.Sheets['Template'] = newWorksheet;

    // 生成Excel文件
    console.log('📁 生成Excel文件...');
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    console.log(`📁 Excel文件生成完成，大小: ${excelBuffer.length} 字节`);

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=processed_template.xlsx');
    
    console.log('✅ 子SKU生成器处理完成，开始发送文件');
    res.send(excelBuffer);

  } catch (err) {
    console.error('子SKU生成器失败:', err);
    res.status(500).json({ message: '子SKU生成器失败: ' + err.message });
  }
});

module.exports = router; 