const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ProductWeblink = require('../models/ProductWeblink');
const SellerInventorySku = require('../models/SellerInventorySku');
const TemplateLink = require('../models/TemplateLink');
const ProductInformation = require('../models/ProductInformation');
const AmzSkuMapping = require('../models/AmzSkuMapping');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const { uploadToOSS, deleteFromOSS } = require('../utils/oss');

// ���Ҵ���ת��Ϊ�������Ƶ�ӳ���
function convertCountryCodeToChinese(countryCode) {
  const countryMapping = {
    'US': '����',
    'CA': '���ô�', 
    'UK': 'Ӣ��',
    'DE': '�¹�',
    'FR': '����',
    'AE': '������',
    'AU': '�Ĵ�����'
  };
  return countryMapping[countryCode] || countryCode;
}

// ���˺���֤ProductInformation���ݵĹ��ߺ���
function filterValidFields(data) {
  // ProductInformationģ���ж�����ֶμ��䳤������
  const validFields = {
    // ԭ���ֶ�
    site: { type: 'string', maxLength: 10 },
    item_sku: { type: 'string', maxLength: 30 },
    original_parent_sku: { type: 'string', maxLength: 30 },
    item_name: { type: 'string', maxLength: 500 },
    external_product_id: { type: 'string', maxLength: 30 },
    external_product_id_type: { type: 'string', maxLength: 30 },
    brand_name: { type: 'string', maxLength: 30 },
    product_description: { type: 'text', maxLength: null }, // TEXT���ͣ�ͨ���޳�������
    bullet_point1: { type: 'string', maxLength: 500 },
    bullet_point2: { type: 'string', maxLength: 500 },
    bullet_point3: { type: 'string', maxLength: 500 },
    bullet_point4: { type: 'string', maxLength: 500 },
    bullet_point5: { type: 'string', maxLength: 500 },
    generic_keywords: { type: 'string', maxLength: 255 },
    main_image_url: { type: 'string', maxLength: 255 },
    swatch_image_url: { type: 'string', maxLength: 255 },
    other_image_url1: { type: 'string', maxLength: 255 },
    other_image_url2: { type: 'string', maxLength: 255 },
    other_image_url3: { type: 'string', maxLength: 255 },
    other_image_url4: { type: 'string', maxLength: 255 },
    other_image_url5: { type: 'string', maxLength: 255 },
    other_image_url6: { type: 'string', maxLength: 255 },
    other_image_url7: { type: 'string', maxLength: 255 },
    other_image_url8: { type: 'string', maxLength: 255 },
    parent_child: { type: 'string', maxLength: 30 },
    parent_sku: { type: 'string', maxLength: 30 },
    relationship_type: { type: 'string', maxLength: 30 },
    variation_theme: { type: 'string', maxLength: 30 },
    color_name: { type: 'string', maxLength: 30 },
    color_map: { type: 'string', maxLength: 30 },
    size_name: { type: 'string', maxLength: 30 },
    size_map: { type: 'string', maxLength: 30 },
    
    // �����ֶ� - ��Ʒ������Ϣ
    feed_product_type: { type: 'string', maxLength: 50 },
    item_type: { type: 'string', maxLength: 100 },
    model: { type: 'string', maxLength: 50 },
    manufacturer: { type: 'string', maxLength: 100 },
    standard_price: { type: 'decimal', maxLength: null },
    quantity: { type: 'integer', maxLength: null },
    list_price: { type: 'decimal', maxLength: null },
    
    // �����ֶ� - ��Ʒ����
    closure_type: { type: 'string', maxLength: 50 },
    outer_material_type1: { type: 'string', maxLength: 50 },
    care_instructions: { type: 'string', maxLength: 100 },
    age_range_description: { type: 'string', maxLength: 50 },
    target_gender: { type: 'string', maxLength: 20 },
    department_name: { type: 'string', maxLength: 50 },
    special_features: { type: 'string', maxLength: 100 },
    style_name: { type: 'string', maxLength: 100 },
    water_resistance_level: { type: 'string', maxLength: 50 },
    recommended_uses_for_product: { type: 'string', maxLength: 100 },
    
    // �����ֶ� - ���ں����ʽ
    seasons1: { type: 'string', maxLength: 20 },
    seasons2: { type: 'string', maxLength: 20 },
    seasons3: { type: 'string', maxLength: 20 },
    seasons4: { type: 'string', maxLength: 20 },
    material_type: { type: 'string', maxLength: 50 },
    lifestyle1: { type: 'string', maxLength: 50 },
    lining_description: { type: 'string', maxLength: 100 },
    strap_type: { type: 'string', maxLength: 50 },
    
    // �����ֶ� - �ߴ������
    storage_volume_unit_of_measure: { type: 'string', maxLength: 20 },
    storage_volume: { type: 'integer', maxLength: null },
    depth_front_to_back: { type: 'decimal', maxLength: null },
    depth_front_to_back_unit_of_measure: { type: 'string', maxLength: 20 },
    depth_width_side_to_side: { type: 'decimal', maxLength: null },
    depth_width_side_to_side_unit_of_measure: { type: 'string', maxLength: 20 },
    depth_height_floor_to_top: { type: 'decimal', maxLength: null },
    depth_height_floor_to_top_unit_of_measure: { type: 'string', maxLength: 20 },
    
    // �����ֶ� - �Ϲ���Ϣ
    cpsia_cautionary_statement1: { type: 'string', maxLength: 100 },
    import_designation: { type: 'string', maxLength: 50 },
    country_of_origin: { type: 'string', maxLength: 50 }
  };

  const filteredData = {};
  
  for (const [fieldName, fieldConfig] of Object.entries(validFields)) {
    if (data[fieldName] !== undefined && data[fieldName] !== null && data[fieldName] !== '') {
      let value = data[fieldName];
      
      // �����ֶ����ͽ��д���
      if (fieldConfig.type === 'string' && fieldConfig.maxLength) {
        // �ַ������͵ĳ��ȴ���
        if (typeof value === 'string' && value.length > fieldConfig.maxLength) {
          // �ضϹ������ַ����������ʡ�Ժ�
          value = value.substring(0, fieldConfig.maxLength - 3) + '...';
          console.warn(`?? �ֶ� ${fieldName} ���ȳ��ޣ��ѽض�: ԭ����${data[fieldName].length} -> �ضϺ�${value.length}`);
        } else if (typeof value !== 'string') {
          // ���ַ���ת��Ϊ�ַ���
          value = String(value);
          if (value.length > fieldConfig.maxLength) {
            value = value.substring(0, fieldConfig.maxLength - 3) + '...';
            console.warn(`?? �ֶ� ${fieldName} ת��Ϊ�ַ����󳤶ȳ��ޣ��ѽض�: ${value.length}`);
          }
        }
      } else if (fieldConfig.type === 'decimal') {
        // decimal���ʹ���
        if (typeof value === 'string') {
          const numValue = parseFloat(value);
          value = isNaN(numValue) ? null : numValue;
        } else if (typeof value === 'number') {
          value = value;
        } else {
          value = null;
        }
      } else if (fieldConfig.type === 'integer') {
        // integer���ʹ���
        if (typeof value === 'string') {
          const intValue = parseInt(value, 10);
          value = isNaN(intValue) ? null : intValue;
        } else if (typeof value === 'number') {
          value = Math.floor(value);
        } else {
          value = null;
        }
      } else if (fieldConfig.type === 'text') {
        // text�����޳������ƣ�ת��Ϊ�ַ�������
        value = String(value);
      }
      
      // ֻ�����nullֵ
      if (value !== null) {
        filteredData[fieldName] = value;
      }
    }
  }
  
  return filteredData;
}

// ����multer�����ļ��ϴ�
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB����
  },
  fileFilter: (req, file, cb) => {
    // ����Excel�ļ�
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`��֧�ֵ��ļ�����: ${file.mimetype}�����ϴ�Excel�ļ�(.xlsx��.xls)`));
    }
  }
});

// ����CPC�ļ��ϴ��м��
const cpcStorage = multer.memoryStorage();
const cpcUpload = multer({
  storage: cpcStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB����
  },
  fileFilter: (req, file, cb) => {
    // ����PDF�ļ�
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('ֻ�����ϴ�PDF�ļ�'));
    }
  }
});

// �������ܣ��Ż���
router.post('/search', async (req, res) => {
  try {
    const { keywords, searchType = 'auto', isFuzzy = true } = req.body;
    console.log('?? ����յ���������:', { keywords, searchType, isFuzzy });
    
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.json({ data: [] });
    }

    let orConditions = [];

    // �����������͹�����ͬ�Ĳ�ѯ����
    if (searchType === 'sku') {
      // ����SKU
      orConditions = keywords.map(keyword => {
        if (isFuzzy) {
          // ģ������
          console.log(`?? ����ģ����������: parent_sku LIKE %${keyword}%`);
          return { parent_sku: { [Op.like]: `%${keyword}%` } };
        } else {
          // ��ȷ����
          console.log(`?? ������ȷ��������: parent_sku = ${keyword}`);
          return { parent_sku: keyword };
        }
      });
    } else if (searchType === 'weblink') {
      // ������Ʒ����/ID - ֻ֧��ģ������
      orConditions = keywords.map(keyword => ({
        weblink: { [Op.like]: `%${keyword}%` }
      }));
    } else {
      // Ĭ��ģʽ��auto��- ͬʱ����SKU�Ͳ�Ʒ����
      orConditions = keywords.map(keyword => ({
        [Op.or]: [
          { parent_sku: { [Op.like]: `%${keyword}%` } },
          { weblink: { [Op.like]: `%${keyword}%` } }
        ]
      }));
    }
    
    console.log('?? ���ղ�ѯ����:', JSON.stringify(orConditions, null, 2));

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
        'cpc_status',
        'cpc_submit',
        'model_number',
        'recommend_age',
        'ads_add',
        'list_parent_sku',
        'no_inventory_rate',
        'sales_30days',
        'seller_name',
        'cpc_files'
      ]
    });

    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '����������' });
  }
});

// ��������״̬
router.post('/batch-update-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '��ѡ��Ҫ���µļ�¼' });
    }

    await ProductWeblink.update(
      { status },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

    res.json({ message: '�������³ɹ�' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '����������' });
  }
});

// ��������CPC��������
router.post('/batch-send-cpc-test', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '��ѡ��Ҫ������Եļ�¼' });
    }

    // ����ѡ�м�¼��CPC����״̬Ϊ"�������"
    await ProductWeblink.update(
      { cpc_status: '�������' },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

    // ���Ͷ���֪ͨ
    try {
      await sendCpcTestNotification(ids.length);
    } catch (notificationError) {
      console.error('����֪ͨ����ʧ�ܣ�����Ӱ�����ݸ���:', notificationError.message);
    }

    res.json({ message: `�ɹ��ύ ${ids.length} ��CPC��������` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '����������' });
  }
});

// �������CPC��Ʒ�ѷ�
router.post('/batch-mark-cpc-sample-sent', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '��ѡ��Ҫ��ǵļ�¼' });
    }

    // ����ѡ�м�¼��CPC����״̬Ϊ"��Ʒ�ѷ�"
    await ProductWeblink.update(
      { cpc_status: '��Ʒ�ѷ�' },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

    // ���Ͷ���֪ͨ
    try {
      await sendCpcSampleSentNotification(ids.length);
    } catch (notificationError) {
      console.error('����֪ͨ����ʧ�ܣ�����Ӱ�����ݸ���:', notificationError.message);
    }

    res.json({ message: `�ɹ���� ${ids.length} ��CPC��Ʒ�ѷ�` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '����������' });
  }
});

// ����ɾ��
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '��ѡ��Ҫɾ���ļ�¼' });
    }

    await ProductWeblink.destroy({
      where: {
        id: { [Op.in]: ids }
      }
    });

    res.json({ message: '����ɾ���ɹ�' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '����������' });
  }
});

// ���µ�����¼
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    await ProductWeblink.update(updateData, {
      where: { id }
    });

    res.json({ message: '���³ɹ�' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '����������' });
  }
});

// ����֪ͨ����
async function sendDingTalkNotification(newProductCount) {
  try {
    const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
    const SECRET_KEY = process.env.SECRET_KEY;
    const MOBILE_NUM_GERRY = process.env.MOBILE_NUM_GERRY;
    
    if (!DINGTALK_WEBHOOK) {
      console.log('����Webhookδ���ã�����֪ͨ');
      return;
    }

    // �����SECRET_KEY������ǩ��
    let webhookUrl = DINGTALK_WEBHOOK;
    if (SECRET_KEY) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${SECRET_KEY}`;
      const sign = crypto.createHmac('sha256', SECRET_KEY)
                        .update(stringToSign)
                        .digest('base64');
      
      // ���ʱ�����ǩ������
      const urlObj = new URL(DINGTALK_WEBHOOK);
      urlObj.searchParams.append('timestamp', timestamp.toString());
      urlObj.searchParams.append('sign', encodeURIComponent(sign));
      webhookUrl = urlObj.toString();
    }

    // ʹ�����õ��ֻ��ţ����û��������ʹ��Ĭ��ֵ
    const mobileNumber = MOBILE_NUM_GERRY || '18676689673';

    const message = {
      msgtype: 'text',
      text: {
        content: `��${newProductCount}����Ʒ�ϴ����ݿ⣬��Ҫ���������ͼ��@${mobileNumber}`
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
      console.log('����֪ͨ���ͳɹ�');
    } else {
      console.error('����֪ͨ����ʧ��:', response.data);
    }
  } catch (error) {
    console.error('���Ͷ���֪ͨʱ����:', error.message);
  }
}

// CPC�������붤��֪ͨ����
async function sendCpcTestNotification(cpcTestCount) {
  try {
    const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
    const SECRET_KEY = process.env.SECRET_KEY;
    const MOBILE_NUM_GERRY = process.env.MOBILE_NUM_GERRY;
    
    if (!DINGTALK_WEBHOOK) {
      console.log('����Webhookδ���ã�����֪ͨ');
      return;
    }

    // �����SECRET_KEY������ǩ��
    let webhookUrl = DINGTALK_WEBHOOK;
    if (SECRET_KEY) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${SECRET_KEY}`;
      const sign = crypto.createHmac('sha256', SECRET_KEY)
                        .update(stringToSign)
                        .digest('base64');
      
      // ���ʱ�����ǩ������
      const urlObj = new URL(DINGTALK_WEBHOOK);
      urlObj.searchParams.append('timestamp', timestamp.toString());
      urlObj.searchParams.append('sign', encodeURIComponent(sign));
      webhookUrl = urlObj.toString();
    }

    // ʹ�����õ��ֻ��ţ����û��������ʹ��Ĭ��ֵ
    const mobileNumber = MOBILE_NUM_GERRY || '18676689673';

    const message = {
      msgtype: 'text',
      text: {
        content: `��${cpcTestCount}���Ʒ����CPC���ԣ��뼰ʱ����@${mobileNumber}`
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
      console.log('CPC�������붤��֪ͨ���ͳɹ�');
    } else {
      console.error('CPC�������붤��֪ͨ����ʧ��:', response.data);
    }
  } catch (error) {
    console.error('����CPC�������붤��֪ͨʱ����:', error.message);
  }
}

// CPC��Ʒ�ѷ�����֪ͨ����
async function sendCpcSampleSentNotification(sampleCount) {
  try {
    const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
    const SECRET_KEY = process.env.SECRET_KEY;
    const MOBILE_NUM_GERRY = process.env.MOBILE_NUM_GERRY;
    
    if (!DINGTALK_WEBHOOK) {
      console.log('����Webhookδ���ã�����֪ͨ');
      return;
    }

    // �����SECRET_KEY������ǩ��
    let webhookUrl = DINGTALK_WEBHOOK;
    if (SECRET_KEY) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${SECRET_KEY}`;
      const sign = crypto.createHmac('sha256', SECRET_KEY)
                        .update(stringToSign)
                        .digest('base64');
      
      // ���ʱ�����ǩ������
      const urlObj = new URL(DINGTALK_WEBHOOK);
      urlObj.searchParams.append('timestamp', timestamp.toString());
      urlObj.searchParams.append('sign', encodeURIComponent(sign));
      webhookUrl = urlObj.toString();
    }

    // ʹ�����õ��ֻ��ţ����û��������ʹ��Ĭ��ֵ
    const mobileNumber = MOBILE_NUM_GERRY || '18676689673';

    const message = {
      msgtype: 'text',
      text: {
        content: `�ѱ��${sampleCount}���ƷCPC��Ʒ�ѷ����뼰ʱ�������Խ��ȣ�@${mobileNumber}`
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
      console.log('CPC��Ʒ�ѷ�����֪ͨ���ͳɹ�');
    } else {
      console.error('CPC��Ʒ�ѷ�����֪ͨ����ʧ��:', response.data);
    }
  } catch (error) {
    console.error('����CPC��Ʒ�ѷ�����֪ͨʱ����:', error.message);
  }
}

// ����SKU�ĺ���
function generateSKU() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let sku = '';
  // ǰ3���ַ�����ĸ
  for (let i = 0; i < 3; i++) {
    sku += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // ��3���ַ�������
  for (let i = 0; i < 3; i++) {
    sku += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return sku;
}

// Excel�ļ��ϴ���ԭ�еģ�
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '��ѡ��Excel�ļ�' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const newRecords = [];
    
    // ������ͷ���ӵڶ��п�ʼ����
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[0].trim()) { // A���в�Ʒ����
        const weblink = row[0].trim();
        
        // ����Ƿ��Ѵ���
        const existing = await ProductWeblink.findOne({
          where: { weblink }
        });
        
        if (!existing) {
          let parent_sku;
          do {
            parent_sku = generateSKU();
            // ȷ�����ɵ�SKU���ظ�
            const skuExists = await ProductWeblink.findOne({
              where: { parent_sku }
            });
            if (!skuExists) break;
          } while (true);

          newRecords.push({
            parent_sku,
            weblink,
            update_time: new Date(),
            status: '������'
          });
        }
      }
    }

    if (newRecords.length > 0) {
      await ProductWeblink.bulkCreate(newRecords);
      res.json({ 
        message: `�ɹ��ϴ� ${newRecords.length} ���¼�¼`,
        count: newRecords.length 
      });
    } else {
      res.json({ 
        message: 'û���ҵ��µĲ�Ʒ����',
        count: 0 
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '�ļ��ϴ�ʧ��: ' + err.message });
  }
});

// �µ�Excel�ϴ���֧��SKU, ����, ��ע��
router.post('/upload-excel-new', (req, res) => {
  // ʹ��multer�м������������ܵĴ���
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '�ļ�̫����ѡ��С��10MB���ļ�' });
      } else if (err.message.includes('��֧�ֵ��ļ�����')) {
        return res.status(400).json({ message: err.message });
      } else {
        return res.status(400).json({ message: '�ļ��ϴ�ʧ��: ' + err.message });
      }
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: '��ѡ��Excel�ļ�' });
      }

          // ��ȡ�������Ϳ���״̬
      const enableDingTalkNotification = req.body.enableDingTalkNotification === 'true';

      let workbook, data;
      try {
        workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          return res.status(400).json({ message: 'Excel�ļ�����Ч�����������ļ���ʽ' });
        }
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
          return res.status(400).json({ message: 'Excel�ļ�������Ϊ�գ���������ݺ������ϴ�' });
        }
        
        data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      } catch (excelError) {
        return res.status(400).json({ message: 'Excel�ļ���ʽ������ȷ���ϴ���ȷ��.xlsx��.xls�ļ�' });
      }

          // �Ż��ձ��� - ����ʧ��
      if (!data || data.length === 0) {
        return res.status(400).json({ message: 'Excel�ļ�Ϊ�գ���������ݺ������ϴ�' });
      }

      // ����Ƿ����κηǿ���
      const hasValidData = data.some(row => row && row[0] && row[0].toString().trim());
      if (!hasValidData) {
        return res.status(400).json({ message: 'Excel�ļ���û���ҵ���Ч�������С���ȷ��A����д��SKU��Ϣ��' });
      }
    const newRecords = [];
    const skippedRecords = [];
    const errors = [];
    
    // ��ƷID��ȡ����
    const extractProductId = (url) => {
      if (!url || typeof url !== 'string') return null;
      
      // 1688.com ���Ӹ�ʽ: https://detail.1688.com/offer/959653322543.html
      const match1688 = url.match(/1688\.com\/offer\/(\d+)/);
      if (match1688) return match1688[1];
      
      // �Ա����Ӹ�ʽ: https://detail.tmall.com/item.htm?id=123456789
      const matchTaobao = url.match(/[?&]id=(\d+)/);
      if (matchTaobao) return matchTaobao[1];
      
      // Amazon���Ӹ�ʽ: https://www.amazon.com/dp/B08N5WRWNW
      const matchAmazon = url.match(/\/dp\/([A-Z0-9]{10})/);
      if (matchAmazon) return matchAmazon[1];
      
      // �������ܵĲ�ƷID��ʽ
      const matchGeneral = url.match(/\/(\d{8,})/);
      if (matchGeneral) return matchGeneral[1];
      
      return null;
    };
    
    // �ӵ�һ�п�ʼ�����ޱ�ͷ��
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[0].toString().trim()) { // A����SKU
        const parent_sku = row[0].toString().trim();
        const weblink = row[1] ? row[1].toString().trim() : '';
        const notice = row[2] ? row[2].toString().trim() : '';
        
        // 1. ���ȼ���ƷID�ظ�������������ȡ��ƷID��
        if (weblink) {
          const productId = extractProductId(weblink);
          if (productId) {
            // �������ݿ����Ƿ����а�����ͬ��ƷID������
            const existingProductId = await ProductWeblink.findOne({
              where: {
                weblink: {
                  [Op.like]: `%${productId}%`
                }
              }
            });
            
            if (existingProductId) {
              const skipReason = '��Ʒ�����Ѿ�����';
              errors.push(`��${i+1}�У���ƷID ${productId} �Ѵ�����SKU ${existingProductId.parent_sku}`);
              skippedRecords.push({
                row: i + 1,
                sku: parent_sku,
                link: weblink,
                reason: skipReason
              });
              continue;
            }
          }
        }

        // 2. ���SKU�Ƿ��Ѵ���
        const existing = await ProductWeblink.findOne({
          where: { parent_sku }
        });
        
        if (existing) {
          const skipReason = 'SKU�Ѵ���';
          errors.push(`��${i+1}�У�SKU ${parent_sku} �Ѵ���`);
          skippedRecords.push({
            row: i + 1,
            sku: parent_sku,
            link: weblink,
            reason: skipReason
          });
          continue;
        }

        newRecords.push({
          parent_sku,
          weblink,
          notice,
          update_time: new Date(),
          status: '�����'
        });
      }
    }

          let resultMessage = '';
      if (newRecords.length > 0) {
        await ProductWeblink.bulkCreate(newRecords);
        resultMessage = `�ɹ��ϴ� ${newRecords.length} ���¼�¼`;
        
        // ���ݿ���״̬�����Ƿ��Ͷ���֪ͨ
        if (enableDingTalkNotification) {
          try {
            await sendDingTalkNotification(newRecords.length);
          } catch (notificationError) {
            // ����֪ͨ����ʧ�ܲ�Ӱ�����ݱ���
          }
        }
      } else {
        // ���û���ҵ��κ���Ч���ݣ�����ͳһ��ʽ
        const errorMsg = errors.length > 0 
          ? `û���ҵ���Ч�������С������ж�������`
          : 'Excel�ļ���û���ҵ���Ч�������С���ȷ��A����д��SKU��Ϣ��';
        return res.status(400).json({ 
          message: errorMsg,
          success: false,
          data: {
            successCount: 0,
            skippedCount: skippedRecords.length,
            totalRows: data.length,
            skippedRecords: skippedRecords,
            errorMessages: errors
          }
        });
      }

      if (errors.length > 0) {
        resultMessage += `\n�����ļ�¼��\n${errors.join('\n')}`;
      }

      res.json({ 
        message: resultMessage,
        success: true,
        data: {
          successCount: newRecords.length,
          skippedCount: skippedRecords.length,
          totalRows: data.length,
          skippedRecords: skippedRecords,
          errorMessages: errors
        }
      });

    } catch (err) {
      res.status(500).json({ message: '�ļ��ϴ�ʧ��: ' + err.message });
    }
  });
});

// ɸѡ���ݽӿ�
router.post('/filter', async (req, res) => {
  try {
    const { status, cpc_status, cpc_submit, seller_name, dateRange } = req.body;
    
    // ������ѯ����
    const whereConditions = {};
    if (status) {
      whereConditions.status = status;
    }
    if (cpc_status) {
      whereConditions.cpc_status = cpc_status;
    }
    if (cpc_submit !== undefined) {
      if (cpc_submit === '') {
        // ɸѡ�յ�CPC�ύ���
        whereConditions.cpc_submit = { [Op.or]: [null, ''] };
      } else {
        whereConditions.cpc_submit = cpc_submit;
      }
    }
    if (seller_name) {
      whereConditions.seller_name = { [Op.like]: `%${seller_name}%` };
    }
    
    // ���ʱ�䷶Χɸѡ
    if (dateRange && dateRange.length === 2) {
      const [startDate, endDate] = dateRange;
      whereConditions.update_time = {
        [Op.between]: [
          new Date(startDate + ' 00:00:00'),
          new Date(endDate + ' 23:59:59')
        ]
      };
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
    console.error('ɸѡ����ʧ��:', err);
    res.status(500).json({ 
      message: 'ɸѡʧ��: ' + (err.message || 'δ֪����'),
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// CPC���ϼܲ�Ʒɸѡ�ӿڣ����������CPC�ύ���Ϊ�գ�
router.post('/filter-cpc-pending-listing', async (req, res) => {
  try {
    const result = await ProductWeblink.findAll({
      where: {
        cpc_status: '�������',
        [Op.or]: [
          { cpc_submit: null },
          { cpc_submit: '' }
        ]
      },
      attributes: [
        'id',
        'parent_sku',
        'weblink',
        'update_time',
        'check_time',
        'status',
        'notice',
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
    res.status(500).json({ message: 'ɸѡCPC���ϼܲ�Ʒʧ��' });
  }
});

// ���������ϲ�Ʒɸѡ�ӿڣ���Pͼ�ʹ��ϴ���
router.post('/filter-can-organize-data', async (req, res) => {
  try {
    const result = await ProductWeblink.findAll({
      where: {
        status: {
          [Op.in]: ['��Pͼ', '���ϴ�']
        }
      },
      attributes: [
        'id',
        'parent_sku',
        'weblink',
        'update_time',
        'check_time',
        'status',
        'notice',
        'cpc_status',
        'cpc_submit',
        'model_number',
        'recommend_age',
        'ads_add',
        'list_parent_sku',
        'no_inventory_rate',
        'sales_30days',
        'seller_name'
      ],
      order: [['update_time', 'DESC']]
    });

    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'ɸѡ���������ϲ�Ʒʧ��' });
  }
});

// ��ȡȫ������ͳ����Ϣ
router.get('/statistics', async (req, res) => {
  try {
    // ��ȡ״̬ͳ��
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

    // ��ȡCPC״̬ͳ��
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

    // ��ȡCPC�ύ���ͳ��
    const cpcSubmitStats = await ProductWeblink.findAll({
      attributes: [
        'cpc_submit',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        cpc_submit: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['cpc_submit'],
      having: require('sequelize').where(
        require('sequelize').fn('COUNT', require('sequelize').col('id')), 
        '>', 
        0
      ),
      raw: true
    });

    console.log('?? CPC�ύ���ͳ�Ʋ�ѯ���:', cpcSubmitStats);

    // ��ȡ��Ӧ��ͳ��
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

    // �����ض�״̬�Ĳ�Ʒ����
    const newProductFirstReviewCount = await ProductWeblink.count({
      where: { status: '��Ʒһ��' }
    });

    const infringementSecondReviewCount = await ProductWeblink.count({
      where: { status: '�����' }
    });

    const waitingPImageCount = await ProductWeblink.count({
      where: { status: '��Pͼ' }
    });

    const waitingUploadCount = await ProductWeblink.count({
      where: { status: '���ϴ�' }
    });

    // ����CPC���Դ���˵Ĳ�Ʒ�������������״̬��
    const cpcTestPendingCount = await ProductWeblink.count({
      where: { cpc_status: '�������' }
    });

    // ����CPC����еĲ�Ʒ����
    const cpcTestingCount = await ProductWeblink.count({
      where: { cpc_status: '������' }
    });

    // ����CPC�ѷ���Ʒ����
    const cpcSampleSentCount = await ProductWeblink.count({
      where: { cpc_status: '��Ʒ�ѷ�' }
    });

    // ����CPC���ϼܲ�Ʒ���������������CPC�ύ���Ϊ�գ�
    const cpcPendingListingCount = await ProductWeblink.count({
      where: {
        cpc_status: '�������',
        [Op.or]: [
          { cpc_submit: null },
          { cpc_submit: '' }
        ]
      }
    });

    // ������������ϵĲ�Ʒ��������Pͼ�ʹ��ϴ���
    const canOrganizeDataCount = await ProductWeblink.count({
      where: {
        status: {
          [Op.in]: ['��Pͼ', '���ϴ�']
        }
      }
    });

    res.json({
      statistics: {
        newProductFirstReview: newProductFirstReviewCount,
        infringementSecondReview: infringementSecondReviewCount,
        waitingPImage: waitingPImageCount,
        waitingUpload: waitingUploadCount,
        canOrganizeData: canOrganizeDataCount,
        cpcTestPending: cpcTestPendingCount,
        cpcTesting: cpcTestingCount,
        cpcSampleSent: cpcSampleSentCount,
        cpcPendingListing: cpcPendingListingCount
      },
      statusStats: statusStats.map(item => ({
        value: item.status,
        count: parseInt(item.count)
      })),
      cpcStatusStats: cpcStatusStats.map(item => ({
        value: item.cpc_status,
        count: parseInt(item.count)
      })),
      cpcSubmitStats: cpcSubmitStats
        .filter(item => item.cpc_submit && item.cpc_submit.trim() !== '') // ���˿�ֵ
        .map(item => ({
          value: item.cpc_submit,
          count: parseInt(item.count) || 0
        }))
        .filter(item => item.count > 0), // ȷ��count����0
      supplierStats: supplierStats.map(item => ({
        value: item.seller_name,
        count: parseInt(item.count)
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '��ȡͳ����Ϣʧ��: ' + err.message });
  }
});



// ���Զ˵� - ���SellerInventorySku��
router.get('/test-seller-sku', async (req, res) => {
  try {
    const count = await SellerInventorySku.count();
    const sample = await SellerInventorySku.findAll({ limit: 3 });
    res.json({ 
      message: '���ݿ����ʳɹ�',
      count: count,
      sample: sample
    });
  } catch (err) {
    res.status(500).json({ 
      message: '���ݿ�����ʧ��',
      error: err.message,
      name: err.name
    });
  }
});

// ==================== CPC�ļ��ϴ���ؽӿ� ====================

// CPC�ļ��ϴ��ӿ�
router.post('/upload-cpc-file/:id', cpcUpload.single('cpcFile'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '��ѡ��CPC�ļ�'
      });
    }

    // ����¼�Ƿ����
    const record = await ProductWeblink.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '��¼������'
      });
    }

    try {
      // �ϴ��ļ���OSS
      const uploadResult = await uploadToOSS(req.file.buffer, req.file.originalname, 'cpc-files');
      
      if (!uploadResult.success) {
        return res.status(500).json({
          code: 1,
          message: '�ļ��ϴ�ʧ��'
        });
      }

      // ����PDF�ļ���ȡStyle Number���Ƽ�����
      let extractedData = { styleNumber: '', recommendAge: '' };
      try {
        const pdfData = await pdf(req.file.buffer);
        extractedData = await extractCpcInfo(pdfData.text);
      } catch (parseError) {
        console.warn('PDF����ʧ�ܣ������Զ���ȡ:', parseError.message);
      }

      // ׼���ļ���Ϣ�����������ļ���
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const fileInfo = {
        uid: Date.now() + '-' + Math.random().toString(36).substr(2, 9), // ��Ψһ��ID
        name: originalName,
        url: uploadResult.url,
        objectName: uploadResult.name,
        size: uploadResult.size,
        uploadTime: new Date().toISOString(),
        extractedData: extractedData
      };

      // ��ȡ���е�CPC�ļ��б�
      let existingFiles = [];
      if (record.cpc_files) {
        try {
          existingFiles = JSON.parse(record.cpc_files);
          if (!Array.isArray(existingFiles)) {
            existingFiles = [];
          }
        } catch (e) {
          existingFiles = [];
        }
      }

      // ������ļ�
      existingFiles.push(fileInfo);

      // �������ݿ��¼
      const updateData = {
        cpc_files: JSON.stringify(existingFiles)
      };

      // ����Ƿ��Ѿ�����ȡ������Ϣ�������ظ���ȡ��
      const hasExistingExtractedData = existingFiles.some(file => 
        file.extractedData && (file.extractedData.styleNumber || file.extractedData.recommendAge)
      );

      // �����Զ��������ݿ��ֶΣ���Ϊ������ȡ��Ϣ��ǰ��ȷ��
      // ֻ�ڿ���̨��¼��ȡ���
      if (!hasExistingExtractedData && (extractedData.styleNumber || extractedData.recommendAge)) {
        console.log(`?? ��CPC�ļ�����ȡ��Ϣ (SKU: ${record.parent_sku}):`);
        if (extractedData.styleNumber) {
          console.log(`  - Style Number: ${extractedData.styleNumber}`);
        }
        if (extractedData.recommendAge) {
          console.log(`  - �Ƽ�����: ${extractedData.recommendAge}`);
        }
      } else if (hasExistingExtractedData && (extractedData.styleNumber || extractedData.recommendAge)) {
        console.log(`?? SKU ${record.parent_sku} ������ȡ��Ϣ�������ظ���ȡ`);
      }

      // ���CPC�ļ������ﵽ2�������ϣ��Զ�����CPC�������Ϊ"�Ѳ���"
      if (existingFiles.length >= 2) {
        updateData.cpc_status = '�Ѳ���';
        console.log(`?? SKU ${record.parent_sku} ��CPC�ļ������ﵽ${existingFiles.length}�����Զ�����CPC�������Ϊ"�Ѳ���"`);
      }

      await ProductWeblink.update(updateData, {
        where: { id: id }
      });

      res.json({
        code: 0,
        message: 'CPC�ļ��ϴ��ɹ�',
        data: {
          fileInfo: fileInfo,
          extractedData: extractedData,
          autoUpdated: {
            styleNumber: !hasExistingExtractedData && !!extractedData.styleNumber,
            recommendAge: !hasExistingExtractedData && !!extractedData.recommendAge,
            cpcStatus: existingFiles.length >= 2
          },
          cpcStatusUpdated: existingFiles.length >= 2,
          totalFileCount: existingFiles.length,
          isFirstExtraction: !hasExistingExtractedData && (extractedData.styleNumber || extractedData.recommendAge),
          hasExistingData: hasExistingExtractedData
        }
      });

    } catch (uploadError) {
      console.error('�ļ��ϴ�ʧ��:', uploadError);
      res.status(500).json({
        code: 1,
        message: '�ļ��ϴ�ʧ��: ' + uploadError.message
      });
    }

  } catch (error) {
    console.error('CPC�ļ��ϴ�����ʧ��:', error);
    res.status(500).json({
      code: 1,
      message: '����������: ' + error.message
    });
  }
});

// ��ȡCPC�ļ��б�
router.get('/cpc-files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const record = await ProductWeblink.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '��¼������'
      });
    }

    let cpcFiles = [];
    if (record.cpc_files) {
      try {
        cpcFiles = JSON.parse(record.cpc_files);
        if (!Array.isArray(cpcFiles)) {
          cpcFiles = [];
        }
      } catch (e) {
        cpcFiles = [];
      }
    }

    res.json({
      code: 0,
      message: '��ȡ�ɹ�',
      data: cpcFiles
    });

  } catch (error) {
    console.error('��ȡCPC�ļ��б�ʧ��:', error);
    res.status(500).json({
      code: 1,
      message: '����������: ' + error.message
    });
  }
});

// ɾ��CPC�ļ�
router.delete('/cpc-file/:id/:fileUid', async (req, res) => {
  try {
    const { id, fileUid } = req.params;
    
    const record = await ProductWeblink.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '��¼������'
      });
    }

    let cpcFiles = [];
    if (record.cpc_files) {
      try {
        cpcFiles = JSON.parse(record.cpc_files);
        if (!Array.isArray(cpcFiles)) {
          cpcFiles = [];
        }
      } catch (e) {
        cpcFiles = [];
      }
    }

    // �ҵ�Ҫɾ�����ļ�
    const fileIndex = cpcFiles.findIndex(file => file.uid === fileUid);
    if (fileIndex === -1) {
      return res.status(404).json({
        code: 1,
        message: '�ļ�������'
      });
    }

    const fileToDelete = cpcFiles[fileIndex];
    
    // ��OSS��ɾ���ļ��������objectName��
    if (fileToDelete.objectName) {
      try {
        await deleteFromOSS(fileToDelete.objectName);
        console.log(`? �Ѵ�OSSɾ���ļ�: ${fileToDelete.objectName}`);
      } catch (ossError) {
        console.warn(`?? OSS�ļ�ɾ��ʧ��: ${fileToDelete.objectName}`, ossError.message);
        // ����ִ�����ݿ�ɾ������ʹOSSɾ��ʧ��
      }
    }

    // ���������Ƴ��ļ�
    cpcFiles.splice(fileIndex, 1);

    // �������ݿ�
    await ProductWeblink.update(
      { cpc_files: JSON.stringify(cpcFiles) },
      { where: { id: id } }
    );

    res.json({
      code: 0,
      message: '�ļ�ɾ���ɹ�'
    });

  } catch (error) {
    console.error('ɾ��CPC�ļ�ʧ��:', error);
    res.status(500).json({
      code: 1,
      message: '����������: ' + error.message
    });
  }
});

// CPC��Ϣ��ȡ����
async function extractCpcInfo(pdfText) {
  try {
    const result = { styleNumber: '', recommendAge: '' };
    
    // ���ȼ���Ƿ�ΪCHILDREN'S PRODUCT CERTIFICATE�ļ�
    const isCpcCertificate = pdfText.includes("CHILDREN'S PRODUCT CERTIFICATE") || 
                           pdfText.includes("CHILDREN'S PRODUCT CERTIFICATE") ||
                           pdfText.includes("CHILDRENS PRODUCT CERTIFICATE");
    
    if (!isCpcCertificate) {
      console.log("?? ��CHILDREN'S PRODUCT CERTIFICATE�ļ���������Ϣ��ȡ");
      return result; // ���ؿս��
    }
    
    console.log("?? ��⵽CHILDREN'S PRODUCT CERTIFICATE�ļ�����ʼ��ȡ��Ϣ...");
    
    // ��ȡStyle Number����"Model"���棩
    const modelMatch = pdfText.match(/Model[:\s]*([A-Z0-9]+)/i);
    if (modelMatch) {
      result.styleNumber = modelMatch[1].trim();
    }
    
    // ��ȡ�Ƽ����䣨��"Age grading"���棩
    const ageMatch = pdfText.match(/Age\s+grading[:\s]*([^\n\r]+)/i);
    if (ageMatch) {
      result.recommendAge = ageMatch[1].trim();
    }
    
    console.log('?? CPC֤����Ϣ��ȡ���:', result);
    return result;
    
  } catch (error) {
    console.error('CPC��Ϣ��ȡʧ��:', error);
    return { styleNumber: '', recommendAge: '' };
  }
}

// CPC�ļ��������ؽӿ�
router.get('/cpc-files/:recordId/:fileUid/download', async (req, res) => {
  try {
    const { recordId, fileUid } = req.params;
    
    // ����¼�Ƿ����
    const record = await ProductWeblink.findByPk(recordId);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '��¼������'
      });
    }

    // ��ȡCPC�ļ��б�
    let cpcFiles = [];
    if (record.cpc_files) {
      try {
        cpcFiles = JSON.parse(record.cpc_files);
        if (!Array.isArray(cpcFiles)) {
          cpcFiles = [];
        }
      } catch (e) {
        cpcFiles = [];
      }
    }

    // �ҵ�Ҫ���ص��ļ�
    const file = cpcFiles.find(f => f.uid === fileUid);
    if (!file || !file.objectName) {
      return res.status(404).json({
        code: 1,
        message: '�ļ�������'
      });
    }

    try {
      // ֱ��ʹ��OSS�ͻ��˻�ȡ�ļ�
      const OSS = require('ali-oss');
      const client = new OSS({
        region: process.env.OSS_REGION,
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET,
        endpoint: process.env.OSS_ENDPOINT
      });
      
      console.log('���ڻ�ȡOSS�ļ�:', file.objectName);
      
      // ֱ�ӻ�ȡ�ļ�����
      const result = await client.get(file.objectName);
      
      // ������Ӧͷ - ��ȫ�����ļ���
      const rawFileName = file.name || 'CPC�ļ�.pdf';
      // �����ļ������Ƴ����п��ܵ���HTTPͷ��������ַ�
      const cleanFileName = rawFileName
        .replace(/[\r\n\t]/g, '') // �Ƴ��س������С��Ʊ��
        .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '') // ֻ�����ɴ�ӡASCII�ַ��������ַ�
        .trim();
      
      const safeFileName = cleanFileName || `cpc_${fileUid}.pdf`;
      const encodedFileName = encodeURIComponent(safeFileName);
      
      // ���ð�ȫ����Ӧͷ
      // ����Ƿ�Ϊ��������ͨ����ѯ�����жϣ�
      const isDownload = req.query.download === 'true';
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': isDownload 
          ? `attachment; filename*=UTF-8''${encodedFileName}`
          : `inline; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': result.content.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });
      
      // �����ļ�����
      res.send(result.content);
      console.log(`? CPC�ļ��������سɹ�: ${file.name}`);
      
    } catch (ossError) {
      console.error('OSS���ش���:', ossError);
      // ���ݴ��������ṩ����ϸ�Ĵ�����Ϣ
      let errorMessage = 'OSS����ʧ��';
      if (ossError.code === 'NoSuchKey') {
        errorMessage = '�ļ������ڻ��ѱ�ɾ��';
      } else if (ossError.code === 'AccessDenied') {
        errorMessage = 'OSS����Ȩ�޲��㣬����ϵ����Ա';
      } else if (ossError.message) {
        errorMessage = `OSS����: ${ossError.message}`;
      }
      
      res.status(500).json({
        code: 1,
        message: errorMessage
      });
    }

  } catch (error) {
    console.error('CPC�ļ���������ʧ��:', error);
    res.status(500).json({
      code: 1,
      message: '����������: ' + error.message
    });
  }
});



// ����ѷģ����� - ͨ��API
// �ϴ�����ѷ����ģ��
router.post('/amazon-templates/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('?? �յ�����ѷģ���ϴ�����');
    
    if (!req.file) {
      return res.status(400).json({ message: '��ѡ��Ҫ�ϴ����ļ�' });
    }

    const { country } = req.body;
    if (!country) {
      return res.status(400).json({ message: '��ָ��վ��' });
    }

    console.log(`?? �ļ���Ϣ: ${req.file.originalname}, ��С: ${req.file.size} �ֽ�, վ��: ${country}`);

    // ��֤�ļ�����
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(req.file.mimetype) && !req.file.originalname.match(/\.(xlsx)$/i)) {
      return res.status(400).json({ message: '���ϴ���Ч��Excel�ļ�����֧��.xlsx��ʽ��' });
    }

    // ʹ��OSS�ϴ�ģ�幦��
    const { uploadTemplateToOSS } = require('../utils/oss');
    
    const originalFileName = req.body.originalFileName || req.file.originalname;
    console.log('?? ʹ���ļ���:', originalFileName);
    
    const uploadResult = await uploadTemplateToOSS(
      req.file.buffer, 
      originalFileName,
      'amazon', 
      null, 
      country
    );

    if (!uploadResult.success) {
      return res.status(500).json({ message: 'ģ���ļ��ϴ�ʧ��' });
    }

    // ����ģ����Ϣ�����ݿ�
    let templateLink = null;
    try {
      templateLink = await TemplateLink.create({
        template_type: 'amazon',
        country: country,
        file_name: originalFileName,
        oss_object_name: uploadResult.name,
        oss_url: uploadResult.url,
        file_size: uploadResult.size,
        upload_time: new Date(),
        is_active: true
      });
      
      console.log(`?? ģ����Ϣ�ѱ��浽���ݿ⣬ID: ${templateLink.id}`);
    } catch (dbError) {
      console.warn('?? ����ģ����Ϣ�����ݿ�ʧ��:', dbError.message);
      // ������ϴ����̣�ֻ�Ǿ���
    }

    const uploadTime = Date.now() - startTime;
    console.log(`? �ϴ���ɣ���ʱ: ${uploadTime}ms`);

    // ������Ӧ����
    const responseData = {
      fileName: uploadResult.originalName,
      url: uploadResult.url,
      objectName: uploadResult.name,
      size: uploadResult.size,
      country: country,
      uploadTime: new Date().toISOString(),
      processingTime: uploadTime
    };

    // ֻ�е�ģ����Ϣ�ɹ����浽���ݿ�ʱ�ŷ���templateId
    if (templateLink && templateLink.id) {
      responseData.templateId = templateLink.id;
    }

    res.json({
      message: `${country}վ�����ϱ�ģ���ϴ��ɹ�`,
      data: responseData
    });

  } catch (error) {
    const uploadTime = Date.now() - startTime;
    console.error(`? �ϴ�����ѷ���ϱ�ģ��ʧ�� (��ʱ: ${uploadTime}ms):`, error);
    
    let errorMessage = '�ϴ�ʧ��: ' + error.message;
    if (error.code === 'RequestTimeout') {
      errorMessage = '�ϴ���ʱ�������������Ӻ�����';
    } else if (error.code === 'AccessDenied') {
      errorMessage = 'OSS����Ȩ�޲��㣬����ϵ����Ա';
    }
    
    res.status(500).json({ 
      message: errorMessage,
      processingTime: uploadTime
    });
  }
});

// ��ȡ����ѷģ���б�
router.get('/amazon-templates', async (req, res) => {
  try {
    const { country } = req.query;
    
    console.log(`?? �����ݿ��ȡ����ѷģ���б�վ��: ${country || 'ȫ��'}`);
    
    // ������ѯ����
    const whereConditions = {
      template_type: 'amazon',
      is_active: true
    };
    
    if (country) {
      whereConditions.country = country;
    }
    
    // �����ݿ��ѯģ���б�
    const templateLinks = await TemplateLink.findAll({
      where: whereConditions,
      order: [['upload_time', 'DESC']]
    });

    // ת��Ϊǰ����Ҫ�ĸ�ʽ
    const files = templateLinks.map(template => ({
      name: template.oss_object_name,
      fileName: template.file_name,
      size: template.file_size || 0,
      lastModified: template.upload_time,
      url: template.oss_url,
      country: template.country,
      id: template.id
    }));

    console.log(`?? �����ݿ��ҵ� ${files.length} ��ģ���ļ�`);

    res.json({
      message: '��ȡ�ɹ�',
      data: files,
      count: files.length
    });

  } catch (error) {
    console.error('�����ݿ��ȡ����ѷģ���б�ʧ��:', error);
    res.status(500).json({ message: '��ȡģ���б�ʧ��: ' + error.message });
  }
});

// ��������ѷģ��
router.get('/amazon-templates/download/:objectName*', async (req, res) => {
  try {
    const objectName = req.params.objectName + (req.params[0] || '');
    
    console.log(`?? �յ���������: ${objectName}`);
    
    if (!objectName) {
      return res.status(400).json({ message: 'ȱ���ļ�������' });
    }

    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const result = await downloadTemplateFromOSS(objectName);
    
    if (!result.success) {
      console.error(`? ����ʧ��: ${result.message}`);
      return res.status(404).json({ message: result.message || 'ģ���ļ�������' });
    }

    console.log(`?? ׼�������ļ�: ${result.fileName} (${result.size} �ֽ�)`);
    
    // ������Ӧͷ
    res.setHeader('Content-Type', result.contentType);
    const encodedFileName = encodeURIComponent(result.fileName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Length', result.size);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    // �����ļ�����
    if (Buffer.isBuffer(result.content)) {
      res.end(result.content);
    } else {
      res.end(Buffer.from(result.content));
    }
    
    console.log(`? �ļ��������: ${result.fileName}`);

  } catch (error) {
    console.error('? ��������ѷģ��ʧ��:', error);
    res.status(500).json({ message: '����ʧ��: ' + error.message });
  }
});

// ɾ������ѷģ��
router.delete('/amazon-templates/:objectName*', async (req, res) => {
  try {
    const objectName = req.params.objectName + (req.params[0] || '');
    
    console.log(`??? �յ�ɾ������: ${objectName}`);
    
    if (!objectName) {
      return res.status(400).json({ message: 'ȱ���ļ�������' });
    }

    const { deleteTemplateFromOSS, backupTemplate } = require('../utils/oss');
    
    // ɾ��ǰ�ȱ���
    try {
      await backupTemplate(objectName, 'amazon');
      console.log('? ģ���ļ��ѱ���');
    } catch (backupError) {
      console.warn('?? ģ���ļ�����ʧ�ܣ�����ɾ������:', backupError.message);
    }
    
    const result = await deleteTemplateFromOSS(objectName);
    
    if (!result.success) {
      return res.status(500).json({ 
        message: result.message || 'ɾ��ʧ��',
        error: result.error 
      });
    }

    // �����ݿ���ɾ��ģ���¼
    try {
      const deletedCount = await TemplateLink.destroy({
        where: {
          oss_object_name: objectName
        }
      });
      
      if (deletedCount > 0) {
        console.log(`?? �Ѵ����ݿ�ɾ�� ${deletedCount} ��ģ���¼`);
      } else {
        console.warn('?? ���ݿ���δ�ҵ���Ӧ��ģ���¼');
      }
    } catch (dbError) {
      console.warn('?? �����ݿ�ɾ��ģ���¼ʧ��:', dbError.message);
      // �����ɾ�����̣�ֻ�Ǿ���
    }

    res.json({ message: 'ģ��ɾ���ɹ�' });

  } catch (error) {
    console.error('ɾ������ѷģ��ʧ��:', error);
    res.status(500).json({ message: 'ɾ��ʧ��: ' + error.message });
  }
});

// ==================== ����Ӣ�����ϱ�ӿ� ====================

// ����Ӣ�����ϱ�
router.post('/generate-uk-data-sheet', async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('?? �յ�����Ӣ�����ϱ�����');
    
    const { parentSkus } = req.body;
    
    if (!Array.isArray(parentSkus) || parentSkus.length === 0) {
      return res.status(400).json({ message: '���ṩҪ�������ϱ��ĸSKU�б�' });
    }

    console.log(`?? ���� ${parentSkus.length} ��ĸSKU:`, parentSkus);

    // ����1: �����ݿ��ȡӢ��ģ���ļ�
    console.log('?? �����ݿ����Ӣ��ģ���ļ�...');
    
    const ukTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: 'UK',
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!ukTemplate) {
      return res.status(400).json({ message: 'δ�ҵ�Ӣ��վ�������ģ�壬�����ϴ�Ӣ��ģ���ļ�' });
    }

    console.log(`?? ʹ��Ӣ��ģ��: ${ukTemplate.file_name} (ID: ${ukTemplate.id})`);

    // ����2: ����ģ���ļ�
    console.log('?? ����Ӣ��ģ���ļ�...');
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const downloadResult = await downloadTemplateFromOSS(ukTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      console.error('? ����Ӣ��ģ��ʧ��:', downloadResult.message);
      return res.status(500).json({ 
        message: `����Ӣ��ģ��ʧ��: ${downloadResult.message}`,
        details: downloadResult.error
      });
    }

    console.log(`? Ӣ��ģ�����سɹ�: ${downloadResult.fileName} (${downloadResult.size} �ֽ�)`);

    // ����3: ��ѯsellerinventory_sku���ȡ��SKU��Ϣ
    console.log('?? ��ѯ��SKU��Ϣ...');
    const inventorySkus = await SellerInventorySku.findAll({
      where: {
        parent_sku: {
          [Op.in]: parentSkus
        }
      },
      order: [['parent_sku', 'ASC'], ['child_sku', 'ASC']]
    });

    if (inventorySkus.length === 0) {
      return res.status(404).json({ 
        message: '�����ݿ���δ�ҵ���ЩĸSKU��Ӧ����SKU��Ϣ' 
      });
    }

    console.log(`?? �ҵ� ${inventorySkus.length} ����SKU��¼`);

    // ����4: ʹ��xlsx�⴦��Excel�ļ�������Ч�����ȶ���
    console.log('?? ��ʼʹ��xlsx�⴦��Excel�ļ�����Ч�ȶ�...');
    const XLSX = require('xlsx');
    
    try {
      console.log(`?? ��ʼ����Excel�ļ����ļ���С: ${downloadResult.size} �ֽ�`);
      
      // ʹ��xlsx��ȡ�������������١��ȶ���
      const workbook = XLSX.read(downloadResult.content, { 
        type: 'buffer',
        cellStyles: true, // ������ʽ
        cellNF: true,     // �������ָ�ʽ
        cellDates: true   // ��������
      });
      
      console.log('? Excel�ļ��������');
      
      // ����Ƿ���Template������
      if (!workbook.Sheets['Template']) {
        return res.status(400).json({ message: 'ģ���ļ���δ�ҵ�Template������' });
      }

      console.log('? �ɹ�����Template������');
      
      const worksheet = workbook.Sheets['Template'];
      
      // ��������ת��Ϊ��ά���飬���ڲ���
      const data = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, // ʹ��������ʽ
        defval: '', // �յ�Ԫ��Ĭ��ֵ
        raw: false  // ����ԭʼ���ݸ�ʽ
      });
      
      console.log(`?? ��������������: ${data.length}`);

      // ������λ�ã��ڵ�3�в��ұ��⣬����Ϊ2��
      let itemSkuCol = -1;
      let colorNameCol = -1;
      let sizeNameCol = -1;
      let brandNameCol = -1;
      let manufacturerCol = -1;
      let externalProductIdTypeCol = -1;
      let modelCol = -1;
      let quantityCol = -1;
      let ageRangeDescriptionCol = -1;
      let parentChildCol = -1;
      let parentSkuCol = -1;
      let relationshipTypeCol = -1;
      let variationThemeCol = -1;
      let countryOfOriginCol = -1;
      let areBatteriesIncludedCol = -1;
    let importDesignationCol = -1;
      let conditionTypeCol = -1;
      let cpsiaCautionaryStatement1Col = -1;
      
      if (data.length >= 3 && data[2]) { // ��3�У�����Ϊ2
        data[2].forEach((header, colIndex) => {
          if (header) {
            const cellValue = header.toString().toLowerCase();
            if (cellValue === 'item_sku') {
              itemSkuCol = colIndex;
            } else if (cellValue === 'color_name') {
              colorNameCol = colIndex;
            } else if (cellValue === 'size_name') {
              sizeNameCol = colIndex;
            } else if (cellValue === 'brand_name') {
              brandNameCol = colIndex;
            } else if (cellValue === 'manufacturer') {
              manufacturerCol = colIndex;
            } else if (cellValue === 'external_product_id_type') {
              externalProductIdTypeCol = colIndex;
            } else if (cellValue === 'model') {
              modelCol = colIndex;
            } else if (cellValue === 'quantity') {
              quantityCol = colIndex;
            } else if (cellValue === 'age_range_description') {
              ageRangeDescriptionCol = colIndex;
            } else if (cellValue === 'parent_child') {
              parentChildCol = colIndex;
            } else if (cellValue === 'parent_sku') {
              parentSkuCol = colIndex;
            } else if (cellValue === 'relationship_type') {
              relationshipTypeCol = colIndex;
            } else if (cellValue === 'variation_theme') {
              variationThemeCol = colIndex;
            } else if (cellValue === 'country_of_origin') {
              countryOfOriginCol = colIndex;
            } else if (cellValue === 'are_batteries_included') {
              areBatteriesIncludedCol = colIndex;
            } else if (cellValue === 'import_designation') {
              importDesignationCol = colIndex;
            } else if (cellValue === 'condition_type') {
              conditionTypeCol = colIndex;
            } else if (cellValue === 'cpsia_cautionary_statement1' || cellValue === 'cpsia_cautionary_statement') {
              cpsiaCautionaryStatement1Col = colIndex;
            }
          }
        });
      }

      if (itemSkuCol === -1 || colorNameCol === -1 || sizeNameCol === -1) {
        return res.status(400).json({ 
          message: '��ģ���3����δ�ҵ�������У�item_sku��color_name��size_name' 
        });
      }

      console.log(`?? �ҵ�������λ�� - item_sku: ${itemSkuCol}, color_name: ${colorNameCol}, size_name: ${sizeNameCol}`);
      console.log(`?? �ҵ���չ��λ�� - brand_name: ${brandNameCol}, manufacturer: ${manufacturerCol}, external_product_id_type: ${externalProductIdTypeCol}`);
      console.log(`?? �ҵ�������λ�� - model: ${modelCol}, quantity: ${quantityCol}, age_range_description: ${ageRangeDescriptionCol}`);
      console.log(`?? �ҵ���ϵ��λ�� - parent_child: ${parentChildCol}, parent_sku: ${parentSkuCol}, relationship_type: ${relationshipTypeCol}, variation_theme: ${variationThemeCol}`);
      console.log(`?? �ҵ�������λ�� - country_of_origin: ${countryOfOriginCol}, are_batteries_included: ${areBatteriesIncludedCol}, condition_type: ${conditionTypeCol}, cpsia_cautionary_statement1: ${cpsiaCautionaryStatement1Col}`);

      // ����5: ׼����д����
      console.log('?? ׼����д���ݵ�Excel...');
      
      // ��ĸSKU����
      const skuGroups = {};
      inventorySkus.forEach(sku => {
        if (!skuGroups[sku.parent_sku]) {
          skuGroups[sku.parent_sku] = [];
        }
        skuGroups[sku.parent_sku].push(sku);
      });

      // ȷ�������������㹻����
      const totalRowsNeeded = 4 + Object.keys(skuGroups).reduce((total, parentSku) => {
        return total + 1 + skuGroups[parentSku].length; // ĸSKU�� + ��SKU����
      }, 0);

      // ��չ��������
      while (data.length < totalRowsNeeded) {
        data.push([]);
      }

      // �ӵ�4�п�ʼ��д���ݣ�����Ϊ3��
      let currentRowIndex = 3; // ��4�п�ʼ������Ϊ3
      
      Object.keys(skuGroups).forEach(parentSku => {
        // ������Ҫ���������
        const allColumns = [
          itemSkuCol, colorNameCol, sizeNameCol, brandNameCol, manufacturerCol,
          externalProductIdTypeCol, modelCol, quantityCol, ageRangeDescriptionCol,
          parentChildCol, parentSkuCol, relationshipTypeCol, variationThemeCol,
          countryOfOriginCol, areBatteriesIncludedCol, conditionTypeCol, cpsiaCautionaryStatement1Col
        ].filter(col => col !== -1);
        const maxCol = Math.max(...allColumns);
        
        // ȷ����ǰ�����㹻����
        if (!data[currentRowIndex]) {
          data[currentRowIndex] = [];
        }
        while (data[currentRowIndex].length <= maxCol) {
          data[currentRowIndex].push('');
        }
        
        // ��дĸSKU��Ϣ
        data[currentRowIndex][itemSkuCol] = `UK${parentSku}`;
        data[currentRowIndex][colorNameCol] = '';
        data[currentRowIndex][sizeNameCol] = '';
        
        // ��дĸSKU�������ֶ�
        if (brandNameCol !== -1) data[currentRowIndex][brandNameCol] = 'SellerFun';
        if (manufacturerCol !== -1) data[currentRowIndex][manufacturerCol] = 'SellerFun';
        if (externalProductIdTypeCol !== -1) data[currentRowIndex][externalProductIdTypeCol] = ''; // ĸSKU����
        if (modelCol !== -1) data[currentRowIndex][modelCol] = `UK${parentSku}`;
        if (quantityCol !== -1) data[currentRowIndex][quantityCol] = ''; // ĸSKU����
        if (ageRangeDescriptionCol !== -1) data[currentRowIndex][ageRangeDescriptionCol] = 'Child';
        if (parentChildCol !== -1) data[currentRowIndex][parentChildCol] = 'Parent';
        if (parentSkuCol !== -1) data[currentRowIndex][parentSkuCol] = ''; // ĸSKU����
        if (relationshipTypeCol !== -1) data[currentRowIndex][relationshipTypeCol] = ''; // ĸSKU����
        if (variationThemeCol !== -1) data[currentRowIndex][variationThemeCol] = 'SizeName-ColorName'; // ĸSKUҲ��дSizeName-ColorName
        if (countryOfOriginCol !== -1) data[currentRowIndex][countryOfOriginCol] = 'China';
        if (areBatteriesIncludedCol !== -1) data[currentRowIndex][areBatteriesIncludedCol] = 'No';
        if (importDesignationCol !== -1) data[currentRowIndex][importDesignationCol] = 'Imported';
        if (conditionTypeCol !== -1) data[currentRowIndex][conditionTypeCol] = 'New';
        
        currentRowIndex++;
        
        // ��д��SKU��
        skuGroups[parentSku].forEach(childSku => {
          if (!data[currentRowIndex]) {
            data[currentRowIndex] = [];
          }
          while (data[currentRowIndex].length <= maxCol) {
            data[currentRowIndex].push('');
          }
          
          data[currentRowIndex][itemSkuCol] = `UK${childSku.child_sku}`;
          data[currentRowIndex][colorNameCol] = childSku.sellercolorname || '';
          data[currentRowIndex][sizeNameCol] = childSku.sellersizename || '';
          
          // ��д��SKU�������ֶ�
          if (brandNameCol !== -1) data[currentRowIndex][brandNameCol] = 'SellerFun';
          if (manufacturerCol !== -1) data[currentRowIndex][manufacturerCol] = 'SellerFun';
          if (externalProductIdTypeCol !== -1) data[currentRowIndex][externalProductIdTypeCol] = 'GCID';
          if (modelCol !== -1) data[currentRowIndex][modelCol] = `UK${parentSku}`;
          if (quantityCol !== -1) data[currentRowIndex][quantityCol] = '15';
          if (ageRangeDescriptionCol !== -1) data[currentRowIndex][ageRangeDescriptionCol] = 'Child';
          if (parentChildCol !== -1) data[currentRowIndex][parentChildCol] = 'Child';
          if (parentSkuCol !== -1) data[currentRowIndex][parentSkuCol] = `UK${parentSku}`;
          if (relationshipTypeCol !== -1) data[currentRowIndex][relationshipTypeCol] = 'Variation';
          if (variationThemeCol !== -1) data[currentRowIndex][variationThemeCol] = 'SizeName-ColorName';
          if (countryOfOriginCol !== -1) data[currentRowIndex][countryOfOriginCol] = 'China';
          if (areBatteriesIncludedCol !== -1) data[currentRowIndex][areBatteriesIncludedCol] = 'No';
          if (conditionTypeCol !== -1) data[currentRowIndex][conditionTypeCol] = 'New';
          if (cpsiaCautionaryStatement1Col !== -1) data[currentRowIndex][cpsiaCautionaryStatement1Col] = 'ChokingHazardSmallParts';
          
          currentRowIndex++;
        });
      });

      console.log(`?? ��д��ɣ�����д�� ${currentRowIndex - 3} ������`);

      // ����6: ����������ת��Ϊ������
      console.log('?? ����Excel�ļ�...');
      const newWorksheet = XLSX.utils.aoa_to_sheet(data);
      
      // ����ԭʼ��������п������
      if (worksheet['!cols']) {
        newWorksheet['!cols'] = worksheet['!cols'];
      }
      if (worksheet['!rows']) {
        newWorksheet['!rows'] = worksheet['!rows'];
      }
      if (worksheet['!merges']) {
        newWorksheet['!merges'] = worksheet['!merges'];
      }
      
      // ���¹�����
      workbook.Sheets['Template'] = newWorksheet;
      
      // ����Excel�ļ�buffer
      const excelBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        cellStyles: true
      });

      const processingTime = Date.now() - startTime;
      console.log(`? Ӣ�����ϱ�������ɣ���ʱ: ${processingTime}ms`);

      // ������Ӧͷ - ʹ���µ�������ʽ��UK_ĸSKU1_ĸSKU2
      const skuList = parentSkus.join('_');
      const fileName = `UK_${skuList}.xlsx`;
      
      console.log(`?? ���ɵ��ļ���: ${fileName}`);
      console.log(`?? ĸSKU�б�: ${JSON.stringify(parentSkus)}`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      console.log(`?? ���õ�Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      
      res.send(excelBuffer);

    } catch (error) {
      console.error('? Excel�ļ�����ʧ��:', error.message);
      throw error;
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`? ����Ӣ�����ϱ�ʧ�� (��ʱ: ${processingTime}ms):`, error);
    
    let errorMessage = '����ʧ��: ' + error.message;
    if (error.code === 'ENOTFOUND') {
      errorMessage = '��������ʧ�ܣ�������������';
    } else if (error.code === 'AccessDenied') {
      errorMessage = 'OSS����Ȩ�޲��㣬����ϵ����Ա';
    }
    
    res.status(500).json({ 
      message: errorMessage,
      processingTime: processingTime
    });
  }
});

// ==================== ��������վ�����ϱ�ӿ� ====================

// �������վ��ģ���в���
router.post('/check-other-site-template', upload.single('file'), async (req, res) => {
  try {
    console.log('?? �յ��������վ��ģ���в�������');
    
    const { country } = req.body;
    const uploadedFile = req.file;
    
    if (!country || !uploadedFile) {
      return res.status(400).json({ message: '���ṩ������Ϣ��Excel�ļ�' });
    }

    // �����ϴ���Excel�ļ�
    const workbook = xlsx.read(uploadedFile.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 3) {
      return res.status(400).json({ message: 'Excel�ļ���ʽ����������Ҫ����ǰ3�У���3��Ϊ�����У�' });
    }

    // ��ȡ�ϴ��ļ����У���3���Ǳ����У�����Ϊ2��
    const uploadedColumns = jsonData[2] ? jsonData[2].filter(col => col && col.toString().trim()) : [];
    
    // ��ȡĿ����ҵ�ģ���ļ�
    const countryTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: country,
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!countryTemplate) {
      return res.status(400).json({ message: `δ�ҵ�${country}վ�������ģ�壬�����ϴ�${country}ģ���ļ�` });
    }

    // ���ز�����ģ���ļ�
    const { downloadTemplateFromOSS } = require('../utils/oss');
    const downloadResult = await downloadTemplateFromOSS(countryTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      return res.status(500).json({ 
        message: `����${country}ģ��ʧ��: ${downloadResult.message}`
      });
    }

    // ����ģ���ļ����У���3�У�
    const templateWorkbook = xlsx.read(downloadResult.content);
    const templateSheetName = templateWorkbook.SheetNames[0];
    const templateWorksheet = templateWorkbook.Sheets[templateSheetName];
    const templateData = xlsx.utils.sheet_to_json(templateWorksheet, { header: 1 });
    
    const templateColumns = templateData.length >= 3 && templateData[2] ? 
      templateData[2].filter(col => col && col.toString().trim()) : [];

    // ���ȱʧ����
    const missingColumns = uploadedColumns.filter(col => 
      !templateColumns.some(templateCol => 
        templateCol.toString().toLowerCase() === col.toString().toLowerCase()
      )
    );

    return res.json({
      success: true,
      uploadedColumns,
      templateColumns,
      missingColumns,
      hasMissingColumns: missingColumns.length > 0
    });

  } catch (error) {
    console.error('? ���ģ���в���ʧ��:', error);
    res.status(500).json({ 
      message: error.message || '���ģ���в���ʱ����δ֪����'
    });
  }
});

// ��������վ�����ϱ�
router.post('/generate-other-site-datasheet', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('?? �յ���������վ�����ϱ�����');
    
    const { country, targetCountry, sourceCountry } = req.body;
    const uploadedFile = req.file;
    
    // ֧�����ֲ�����ʽ��country �� targetCountry
    const actualCountry = country || targetCountry;
    
    if (!actualCountry || !uploadedFile) {
      return res.status(400).json({ message: '���ṩ������Ϣ��Excel�ļ�' });
    }

    console.log(`?? ����Դ����: ${sourceCountry || 'δ֪'} -> Ŀ�����: ${actualCountry}, �ļ�: ${uploadedFile.originalname}`);

    // �����ı��ֶε�ת�����򣨻���Դ���Һ�Ŀ����ң�
    const processTextForUKAUAE = (text, fieldType = 'general') => {
      if (!text) return text;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = actualCountry === 'US' || actualCountry === 'CA';
      const targetIsUKAUAE = actualCountry === 'UK' || actualCountry === 'AU' || actualCountry === 'AE';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        if (fieldType === 'brand_name') {
          return 'JiaYou';  // SellerFun -> JiaYou
        }
        if (fieldType === 'manufacturer') {
          return text.replace(/SellerFun/g, 'JiaYou');
        }
        if (fieldType === 'item_name') {
          return text.replace(/SellerFun/g, 'JiaYou');
        }
        return text;
      }
      
      // ԭ���߼�������UK/AU/AE���ϱ�ʱ�Ĵ���
      if (targetIsUKAUAE) {
        // ����brand_name��manufacturer�ֶΣ�ͳһ����ΪSellerFun
        if (fieldType === 'brand_name' || fieldType === 'manufacturer') {
          return 'SellerFun';
        }
        // ����item_name�ֶΣ������ͷ��JiaYouҪ�滻��SellerFun
        if (fieldType === 'item_name') {
          return text.replace(/^JiaYou/g, 'SellerFun');
        }
        // ����department_name�ֶε����⴦��
        if (fieldType === 'department_name') {
          if (text.trim() === 'Unisex Child') {
            if (actualCountry === 'UK' || actualCountry === 'AU') {
              return 'Unisex Kids';
            } else if (actualCountry === 'AE') {
              return 'unisex-child';
            }
          }
        }
      }
      
      return text;
    };

    // ����SKU�ֶε�ת�����򣨻���Դ���Һ�Ŀ����ң�
    const processSkuForUKAUAE = (sku) => {
      if (!sku) return sku;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = actualCountry === 'US' || actualCountry === 'CA';
      const targetIsUKAUAE = actualCountry === 'UK' || actualCountry === 'AU' || actualCountry === 'AE';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        // UKǰ׺��ΪUSǰ׺
        return sku.replace(/^UK/, 'US');
      }
      
      // ԭ���߼�������UK/AU/AE���ϱ�ʱ�Ĵ���
      if (targetIsUKAUAE) {
        // SKUǰ׺��ΪUK
        return sku.replace(/^[A-Z]{2}/, 'UK');
      }
      
      return sku;
    };

    // ����model�ֶε�ת�����򣨻���Դ���Һ�Ŀ����ң�
    const processModelForUKAUAE = (model) => {
      if (!model) return model;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = actualCountry === 'US' || actualCountry === 'CA';
      const targetIsUKAUAE = actualCountry === 'UK' || actualCountry === 'AU' || actualCountry === 'AE';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        // UKǰ׺��ΪUSǰ׺
        if (model.startsWith('UK')) {
          return model.replace(/^UK/, 'US');
        }
        // ���û��ǰ׺�����USǰ׺
        return 'US' + model;
      }
      
      // ԭ���߼�������UK/AU/AE���ϱ�ʱ�Ĵ���
      if (targetIsUKAUAE) {
        // model�ֶμ���UKǰ׺
        if (model.startsWith('UK')) {
          return model;
        }
        return 'UK' + model;
      }
      
      return model;
    };

    // ����ͼƬURL��ת�����򣨻���Դ���Һ�Ŀ����ң�
    const processImageUrlForUKAUAE = (url) => {
      if (!url) return url;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = actualCountry === 'US' || actualCountry === 'CA';
      const targetIsUKAUAE = actualCountry === 'UK' || actualCountry === 'AU' || actualCountry === 'AE';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        // ������pic.sellerfun.net -> pic.jiayou.ink
        let processedUrl = url.replace(/pic\.sellerfun\.net/g, 'pic.jiayou.ink');
        
        // SKUǰ׺�ĳ�US (���磺UKXBC188 -> USXBC188)
        processedUrl = processedUrl.replace(/\/UK([A-Z0-9]+)\//g, '/US$1/');
        processedUrl = processedUrl.replace(/\/UK([A-Z0-9]+)\./g, '/US$1.');
        
        return processedUrl;
      }
      
      // ԭ���߼�������UK/AU/AE���ϱ�ʱ�Ĵ���
      if (targetIsUKAUAE) {
        // �����������pic.jiayou.ink���ĳ�pic.sellerfun.net
        let processedUrl = url.replace(/pic\.jiayou\.ink/g, 'pic.sellerfun.net');
        
        // SKUǰ׺�ĳ�UK (���磺USXBC188 -> UKXBC188)
        processedUrl = processedUrl.replace(/\/US([A-Z0-9]+)\//g, '/UK$1/');
        processedUrl = processedUrl.replace(/\/US([A-Z0-9]+)\./g, '/UK$1.');
        
        return processedUrl;
      }
      
      return url;
    };

    // ����Ӣ��վ��ĵ�λת��
    const processUnitForUK = (unit) => {
      if (!unit || actualCountry !== 'UK') return unit;
      
      // Liters��Ϊliter
      if (unit === 'Liters') {
        return 'liter';
      }
      
      // Centimeters��ΪCentimetres
      if (unit === 'Centimeters') {
        return 'Centimetres';
      }
      
      return unit;
    };

    // ����Ӣ��վ��ĳߴ���ֵת����Ӣ��ת���ף�
    const processDimensionForUK = (value, unit) => {
      if (!value || actualCountry !== 'UK') return value;
      
      // �����λ��Inches����ֵ��Ҫ����2.54ת��Ϊ����
      if (unit === 'Inches' && !isNaN(parseFloat(value))) {
        return (parseFloat(value) * 2.54).toFixed(2);
      }
      
      return value;
    };

    // ����1: �����ϴ���Excel�ļ�
    console.log('?? �����ϴ���Excel�ļ�...');
    const workbook = xlsx.read(uploadedFile.buffer);
    
    // ����Ѱ��Template���������û����ʹ�õ�һ��������
    let sheetName;
    let worksheet;
    
    if (workbook.Sheets['Template']) {
      sheetName = 'Template';
      worksheet = workbook.Sheets['Template'];
      console.log('? �ҵ�Template������ʹ��Template������');
    } else {
      sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      console.log(`?? δ�ҵ�Template������ʹ�õ�һ��������: ${sheetName}`);
    }
    
    console.log(`?? ��ǰʹ�õĹ�����: ${sheetName}`);
    
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel�ļ���ʽ����������Ҫ���������к�������' });
    }

    // ����2: �������ݲ����浽���ݿ⣬ͬʱ׼����д��Excel
    console.log('?? �������ݵ����ݿⲢ׼����д��Excel...');
    
    // ��ȡ�����У���3���Ǳ����У�����Ϊ2��
    if (jsonData.length < 4) {
      return res.status(400).json({ message: 'Excel�ļ���ʽ����������Ҫ����ǰ3�б���˵����������' });
    }
    
    const headers = jsonData[2]; // ��3���Ǳ�����
    const dataRows = jsonData.slice(3); // ��4�п�ʼ��������
    
    const savedRecords = [];
    const processedRecords = []; // ����Excel��д�ĸɾ�����
    
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      
      // �������ݶ���
      const rowData = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          rowData[header.toLowerCase().replace(/\s+/g, '_')] = row[index];
        }
      });
      
      // ����site�ֶ�Ϊѡ��Ĺ��ң�ת��Ϊ�������ƣ�
      rowData.site = convertCountryCodeToChinese(actualCountry);
      
      // ����original_parent_sku�ֶΣ�����parent_child���жϣ�
      if (rowData.parent_child === 'Parent' && rowData.item_sku && rowData.item_sku.length > 2) {
        // ��parent_childΪ"Parent"ʱ��item_sku�е���ϢΪĸSKU��ȥ��ǰ�����ַ�
        rowData.original_parent_sku = rowData.item_sku.substring(2);
      } else if (rowData.parent_child === 'Child' && rowData.parent_sku && rowData.parent_sku.length > 2) {
        // ��parent_childΪ"Child"ʱ����parent_sku�ֶλ�ȡĸSKU��Ϣ��ȥ��ǰ�����ַ�
        rowData.original_parent_sku = rowData.parent_sku.substring(2);
      } else if (rowData.item_sku && rowData.item_sku.length > 2) {
        // ���ݴ������û��parent_child��Ϣ��ʹ��ԭ���߼�
        rowData.original_parent_sku = rowData.item_sku.substring(2);
        console.warn(`?? ��¼ȱ��parent_child��Ϣ��ʹ��item_sku����original_parent_sku: ${rowData.item_sku} -> ${rowData.original_parent_sku}`);
      }
      
      // ���˺���֤���ݣ�ֻ����ģ���ж�����ֶ�
      const filteredData = filterValidFields(rowData);
      
      // ���浽���ݿ�
      try {
        const savedRecord = await ProductInformation.create(filteredData);
        savedRecords.push(savedRecord);
      } catch (error) {
        console.warn(`?? �����¼ʧ��: ${JSON.stringify(filteredData)}, ����: ${error.message}`);
        console.warn(`ԭʼ�����ֶ�����: ${Object.keys(rowData).length}, ���˺��ֶ�����: ${Object.keys(filteredData).length}`);
      }
      
      // ͬʱ����һ������Excel��д
      processedRecords.push(rowData);
    }

    console.log(`? �ɹ����� ${savedRecords.length} ����¼�����ݿ�`);
    console.log(`? ׼���� ${processedRecords.length} ����¼����Excel��д`);

    // ����3: ��ȡ��Ӧ���ҵ�ģ���ļ�
    console.log(`?? ����${actualCountry}վ���ģ���ļ�...`);
    
    const countryTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: actualCountry,
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!countryTemplate) {
      return res.status(400).json({ message: `δ�ҵ�${actualCountry}վ�������ģ�壬�����ϴ�${actualCountry}ģ���ļ�` });
    }

    console.log(`?? ʹ��${actualCountry}ģ��: ${countryTemplate.file_name} (ID: ${countryTemplate.id})`);

    // ����4: ����ģ���ļ�
    console.log(`?? ����${actualCountry}ģ���ļ�...`);
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const downloadResult = await downloadTemplateFromOSS(countryTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      console.error(`? ����${actualCountry}ģ��ʧ��:`, downloadResult.message);
      return res.status(500).json({ 
        message: `����${actualCountry}ģ��ʧ��: ${downloadResult.message}`,
        details: downloadResult.error
      });
    }

    console.log(`? ${actualCountry}ģ�����سɹ�: ${downloadResult.fileName} (${downloadResult.size} �ֽ�)`);

    // ����5: ʹ��xlsx�⴦��ģ���ļ����ο�Ӣ�����ϱ����ȷʵ�֣�
    console.log('?? ��ʼʹ��xlsx�⴦��Excel�ļ�...');
    
    // ����ģ���ļ�
    const templateWorkbook = xlsx.read(downloadResult.content, { 
      type: 'buffer',
      cellStyles: true, // ������ʽ
      cellNF: true,     // �������ָ�ʽ
      cellDates: true   // ��������
    });
    
    // ����Ƿ���Template������
    if (!templateWorkbook.Sheets['Template']) {
      return res.status(400).json({ message: 'ģ���ļ���δ�ҵ�Template������' });
    }

    console.log('? �ɹ�����Template������');
    
    const templateWorksheet = templateWorkbook.Sheets['Template'];
    
    // ��������ת��Ϊ��ά���飬���ڲ���
    const data = xlsx.utils.sheet_to_json(templateWorksheet, { 
      header: 1, // ʹ��������ʽ
      defval: '', // �յ�Ԫ��Ĭ��ֵ
      raw: false  // ����ԭʼ���ݸ�ʽ
    });
    
    console.log(`?? ��������������: ${data.length}`);

    // ����6: ������λ�ã��ڵ�3�в��ұ��⣬����Ϊ2��
    console.log('?? ������λ��...');
    let itemSkuCol = -1;
    let itemNameCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;
    let brandNameCol = -1;
    let manufacturerCol = -1;
    let mainImageUrlCol = -1;
    let otherImageUrl1Col = -1;
    let otherImageUrl2Col = -1;
    let otherImageUrl3Col = -1;
    let otherImageUrl4Col = -1;
    let otherImageUrl5Col = -1;
    let otherImageUrl6Col = -1;
    let otherImageUrl7Col = -1;
    let otherImageUrl8Col = -1;
    let productDescriptionCol = -1;
    let bulletPoint1Col = -1;
    let bulletPoint2Col = -1;
    let bulletPoint3Col = -1;
    let bulletPoint4Col = -1;
    let bulletPoint5Col = -1;
    
    // ����ȱʧ�ֶε��б���
    let feedProductTypeCol = -1;
    let externalProductIdTypeCol = -1;
    let quantityCol = -1;
    let ageRangeDescriptionCol = -1;
    let swatchImageUrlCol = -1;
    let relationshipTypeCol = -1;
    let variationThemeCol = -1;
    let parentSkuCol = -1;
    let parentChildCol = -1;
    let styleNameCol = -1;
    let colorMapCol = -1;
    let materialTypeCol = -1;
    let genericKeywordsCol = -1;
    let waterResistanceLevelCol = -1;
    let sizeMapCol = -1;
    let countryOfOriginCol = -1;
    let cpsiaCautionaryStatement1Col = -1;
    let conditionTypeCol = -1;
    let departmentNameCol = -1;
    
    // ���ô�վ�������ֶε��б���
    let closureTypeCol = -1;
    let careInstructionsCol = -1;
    let modelCol = -1;
    let targetGenderCol = -1;
    let recommendedUsesForProductCol = -1;
    let seasons1Col = -1;
    let seasons2Col = -1;
    let seasons3Col = -1;
    let seasons4Col = -1;
    let lifestyle1Col = -1;
    let storageVolumeUnitOfMeasureCol = -1;
    let storageVolumeCol = -1;
    let depthFrontToBackCol = -1;
    let depthFrontToBackUnitOfMeasureCol = -1;
    let depthWidthSideToSideCol = -1;
    let depthWidthSideToSideUnitOfMeasureCol = -1;
    let depthHeightFloorToTopCol = -1;
    let depthHeightFloorToTopUnitOfMeasureCol = -1;
    let manufacturerContactInformationCol = -1;
    
    if (data.length >= 3 && data[2]) { // ��3�У�����Ϊ2
      data[2].forEach((header, colIndex) => {
        if (header) {
          const cellValue = header.toString().toLowerCase();
          if (cellValue === 'item_sku') {
            itemSkuCol = colIndex;
          } else if (cellValue === 'item_name') {
            itemNameCol = colIndex;
          } else if (cellValue === 'color_name') {
            colorNameCol = colIndex;
          } else if (cellValue === 'size_name') {
            sizeNameCol = colIndex;
          } else if (cellValue === 'brand_name') {
            brandNameCol = colIndex;
          } else if (cellValue === 'manufacturer') {
            manufacturerCol = colIndex;
          } else if (cellValue === 'main_image_url') {
            mainImageUrlCol = colIndex;
          } else if (cellValue === 'other_image_url1') {
            otherImageUrl1Col = colIndex;
          } else if (cellValue === 'other_image_url2') {
            otherImageUrl2Col = colIndex;
          } else if (cellValue === 'other_image_url3') {
            otherImageUrl3Col = colIndex;
          } else if (cellValue === 'other_image_url4') {
            otherImageUrl4Col = colIndex;
          } else if (cellValue === 'other_image_url5') {
            otherImageUrl5Col = colIndex;
          } else if (cellValue === 'product_description') {
            productDescriptionCol = colIndex;
          } else if (cellValue === 'bullet_point1') {
            bulletPoint1Col = colIndex;
          } else if (cellValue === 'bullet_point2') {
            bulletPoint2Col = colIndex;
          } else if (cellValue === 'bullet_point3') {
            bulletPoint3Col = colIndex;
          } else if (cellValue === 'bullet_point4') {
            bulletPoint4Col = colIndex;
          } else if (cellValue === 'bullet_point5') {
            bulletPoint5Col = colIndex;
          } else if (cellValue === 'feed_product_type') {
            feedProductTypeCol = colIndex;
          } else if (cellValue === 'external_product_id_type') {
            externalProductIdTypeCol = colIndex;
          } else if (cellValue === 'quantity') {
            quantityCol = colIndex;
          } else if (cellValue === 'age_range_description') {
            ageRangeDescriptionCol = colIndex;
          } else if (cellValue === 'swatch_image_url') {
            swatchImageUrlCol = colIndex;
          } else if (cellValue === 'relationship_type') {
            relationshipTypeCol = colIndex;
          } else if (cellValue === 'variation_theme') {
            variationThemeCol = colIndex;
          } else if (cellValue === 'parent_sku') {
            parentSkuCol = colIndex;
          } else if (cellValue === 'parent_child') {
            parentChildCol = colIndex;
          } else if (cellValue === 'style_name') {
            styleNameCol = colIndex;
          } else if (cellValue === 'color_map') {
            colorMapCol = colIndex;
          } else if (cellValue === 'material_type') {
            materialTypeCol = colIndex;
          } else if (cellValue === 'generic_keywords') {
            genericKeywordsCol = colIndex;
          } else if (cellValue === 'water_resistance_level') {
            waterResistanceLevelCol = colIndex;
          } else if (cellValue === 'size_map') {
            sizeMapCol = colIndex;
          } else if (cellValue === 'country_of_origin') {
            countryOfOriginCol = colIndex;
          } else if (cellValue === 'cpsia_cautionary_statement1' || cellValue === 'cpsia_cautionary_statement') {
            cpsiaCautionaryStatement1Col = colIndex;
          } else if (cellValue === 'condition_type') {
            conditionTypeCol = colIndex;
          } else if (cellValue === 'closure_type') {
            closureTypeCol = colIndex;
          } else if (cellValue === 'care_instructions') {
            careInstructionsCol = colIndex;
          } else if (cellValue === 'model') {
            modelCol = colIndex;
          } else if (cellValue === 'target_gender') {
            targetGenderCol = colIndex;
          } else if (cellValue === 'recommended_uses_for_product') {
            recommendedUsesForProductCol = colIndex;
          } else if (cellValue === 'seasons1') {
            seasons1Col = colIndex;
          } else if (cellValue === 'seasons2') {
            seasons2Col = colIndex;
          } else if (cellValue === 'seasons3') {
            seasons3Col = colIndex;
          } else if (cellValue === 'seasons4') {
            seasons4Col = colIndex;
          } else if (cellValue === 'lifestyle1') {
            lifestyle1Col = colIndex;
          } else if (cellValue === 'storage_volume_unit_of_measure') {
            storageVolumeUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'storage_volume') {
            storageVolumeCol = colIndex;
          } else if (cellValue === 'depth_front_to_back') {
            depthFrontToBackCol = colIndex;
          } else if (cellValue === 'depth_front_to_back_unit_of_measure') {
            depthFrontToBackUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'depth_width_side_to_side') {
            depthWidthSideToSideCol = colIndex;
          } else if (cellValue === 'depth_width_side_to_side_unit_of_measure') {
            depthWidthSideToSideUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'depth_height_floor_to_top') {
            depthHeightFloorToTopCol = colIndex;
          } else if (cellValue === 'depth_height_floor_to_top_unit_of_measure') {
            depthHeightFloorToTopUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'manufacturer_contact_information') {
            manufacturerContactInformationCol = colIndex;
          } else if (cellValue === 'department_name') {
            departmentNameCol = colIndex;
          }
        }
      });
    }

    console.log(`?? �ҵ���λ�� - item_sku: ${itemSkuCol}, item_name: ${itemNameCol}, color_name: ${colorNameCol}, size_name: ${sizeNameCol}`);
    
    // ���ԣ�����3�б���
    console.log('?? ��3�б�������:', data[2]);
    
    // ����Ƿ��ҵ��˹ؼ���
    if (itemSkuCol === -1) {
      console.log('? ���棺δ�ҵ�item_sku��!');
    }
    if (itemNameCol === -1) {
      console.log('? ���棺δ�ҵ�item_name��!');
    }

    // ����7: ׼����д����
    console.log('?? ׼����д���ݵ�Excel...');
    
    // ȷ�������������㹻����
    const totalRowsNeeded = 3 + processedRecords.length; // ǰ3�б��� + ������
    while (data.length < totalRowsNeeded) {
      data.push([]);
    }

    // �ӵ�4�п�ʼ��д���ݣ�����Ϊ3��
    let currentRowIndex = 3; // ��4�п�ʼ������Ϊ3
    
    processedRecords.forEach((record, index) => {
      const recordData = record; // processedRecords�Ѿ��Ǹɾ������ݶ���
      
      // ���ԣ������һ����¼����д����
      if (index === 0) {
        console.log('?? ��д��һ����¼:', {
          item_sku: recordData.item_sku,
          item_name: recordData.item_name,
          color_name: recordData.color_name,
          size_name: recordData.size_name,
          brand_name: recordData.brand_name
        });
        console.log(`?? ��д����${currentRowIndex + 1}�У�����${currentRowIndex}��`);
      }
      
      // ������Ҫ���������
      const allColumns = [
        itemSkuCol, itemNameCol, colorNameCol, sizeNameCol, brandNameCol, manufacturerCol,
        mainImageUrlCol, otherImageUrl1Col, otherImageUrl2Col, otherImageUrl3Col, 
        otherImageUrl4Col, otherImageUrl5Col, productDescriptionCol,
        bulletPoint1Col, bulletPoint2Col, bulletPoint3Col, bulletPoint4Col, bulletPoint5Col,
        feedProductTypeCol, externalProductIdTypeCol, quantityCol, ageRangeDescriptionCol,
        swatchImageUrlCol, relationshipTypeCol, variationThemeCol, parentSkuCol, parentChildCol,
        styleNameCol, colorMapCol, materialTypeCol, genericKeywordsCol, waterResistanceLevelCol,
        sizeMapCol, countryOfOriginCol, cpsiaCautionaryStatement1Col, conditionTypeCol, departmentNameCol
      ].filter(col => col !== -1);
      const maxCol = Math.max(...allColumns);
      
      // ȷ����ǰ�����㹻����
      if (!data[currentRowIndex]) {
        data[currentRowIndex] = [];
      }
      while (data[currentRowIndex].length <= maxCol) {
        data[currentRowIndex].push('');
      }
      
      // ��д����
      if (itemSkuCol !== -1) data[currentRowIndex][itemSkuCol] = processSkuForUKAUAE(recordData.item_sku || '');
      if (itemNameCol !== -1) data[currentRowIndex][itemNameCol] = processTextForUKAUAE(recordData.item_name || '', 'item_name');
      if (colorNameCol !== -1) data[currentRowIndex][colorNameCol] = recordData.color_name || '';
      if (sizeNameCol !== -1) data[currentRowIndex][sizeNameCol] = recordData.size_name || '';
      if (brandNameCol !== -1) data[currentRowIndex][brandNameCol] = processTextForUKAUAE(recordData.brand_name || '', 'brand_name');
      if (manufacturerCol !== -1) data[currentRowIndex][manufacturerCol] = processTextForUKAUAE(recordData.manufacturer || '', 'manufacturer');
      if (mainImageUrlCol !== -1) data[currentRowIndex][mainImageUrlCol] = processImageUrlForUKAUAE(recordData.main_image_url || '');
      if (otherImageUrl1Col !== -1) data[currentRowIndex][otherImageUrl1Col] = processImageUrlForUKAUAE(recordData.other_image_url1 || '');
      if (otherImageUrl2Col !== -1) data[currentRowIndex][otherImageUrl2Col] = processImageUrlForUKAUAE(recordData.other_image_url2 || '');
      if (otherImageUrl3Col !== -1) data[currentRowIndex][otherImageUrl3Col] = processImageUrlForUKAUAE(recordData.other_image_url3 || '');
      if (otherImageUrl4Col !== -1) data[currentRowIndex][otherImageUrl4Col] = processImageUrlForUKAUAE(recordData.other_image_url4 || '');
      if (otherImageUrl5Col !== -1) data[currentRowIndex][otherImageUrl5Col] = processImageUrlForUKAUAE(recordData.other_image_url5 || '');
      if (otherImageUrl6Col !== -1) data[currentRowIndex][otherImageUrl6Col] = processImageUrlForUKAUAE(recordData.other_image_url6 || '');
      if (otherImageUrl7Col !== -1) data[currentRowIndex][otherImageUrl7Col] = processImageUrlForUKAUAE(recordData.other_image_url7 || '');
      if (otherImageUrl8Col !== -1) data[currentRowIndex][otherImageUrl8Col] = processImageUrlForUKAUAE(recordData.other_image_url8 || '');
      if (productDescriptionCol !== -1) data[currentRowIndex][productDescriptionCol] = recordData.product_description || '';
      if (bulletPoint1Col !== -1) data[currentRowIndex][bulletPoint1Col] = recordData.bullet_point1 || '';
      if (bulletPoint2Col !== -1) data[currentRowIndex][bulletPoint2Col] = recordData.bullet_point2 || '';
      if (bulletPoint3Col !== -1) data[currentRowIndex][bulletPoint3Col] = recordData.bullet_point3 || '';
      if (bulletPoint4Col !== -1) data[currentRowIndex][bulletPoint4Col] = recordData.bullet_point4 || '';
      if (bulletPoint5Col !== -1) data[currentRowIndex][bulletPoint5Col] = recordData.bullet_point5 || '';
      
      // ��д�����ֶ�����
      if (feedProductTypeCol !== -1) data[currentRowIndex][feedProductTypeCol] = recordData.feed_product_type || '';
      if (externalProductIdTypeCol !== -1) data[currentRowIndex][externalProductIdTypeCol] = recordData.external_product_id_type || '';
      if (quantityCol !== -1) data[currentRowIndex][quantityCol] = recordData.quantity || '';
      if (ageRangeDescriptionCol !== -1) data[currentRowIndex][ageRangeDescriptionCol] = recordData.age_range_description || '';
      if (swatchImageUrlCol !== -1) data[currentRowIndex][swatchImageUrlCol] = processImageUrlForUKAUAE(recordData.swatch_image_url || '');
      if (relationshipTypeCol !== -1) data[currentRowIndex][relationshipTypeCol] = recordData.relationship_type || '';
      if (variationThemeCol !== -1) data[currentRowIndex][variationThemeCol] = recordData.variation_theme || '';
      if (parentSkuCol !== -1) data[currentRowIndex][parentSkuCol] = processSkuForUKAUAE(recordData.parent_sku || '');
      if (parentChildCol !== -1) data[currentRowIndex][parentChildCol] = recordData.parent_child || '';
      if (styleNameCol !== -1) data[currentRowIndex][styleNameCol] = recordData.style_name || '';
      if (colorMapCol !== -1) data[currentRowIndex][colorMapCol] = recordData.color_map || '';
      if (materialTypeCol !== -1) data[currentRowIndex][materialTypeCol] = recordData.material_type || '';
      if (genericKeywordsCol !== -1) data[currentRowIndex][genericKeywordsCol] = recordData.generic_keywords || '';
      if (waterResistanceLevelCol !== -1) data[currentRowIndex][waterResistanceLevelCol] = recordData.water_resistance_level || '';
      if (sizeMapCol !== -1) data[currentRowIndex][sizeMapCol] = recordData.size_map || '';
      if (countryOfOriginCol !== -1) data[currentRowIndex][countryOfOriginCol] = recordData.country_of_origin || '';
      if (cpsiaCautionaryStatement1Col !== -1) {
        // ���ô�վ�����⴦��ʹ���ض���ʽ�ľ������
        if (actualCountry === 'CA') {
          data[currentRowIndex][cpsiaCautionaryStatement1Col] = 'Choking Hazard - Small Parts';
        } else {
          data[currentRowIndex][cpsiaCautionaryStatement1Col] = 'ChokingHazardSmallParts';
        }
      }
      if (conditionTypeCol !== -1) {
        // ������վ�����⴦��ͳһ��д "new, new"
        if (actualCountry === 'AE') {
          data[currentRowIndex][conditionTypeCol] = 'new, new';
        } else {
          data[currentRowIndex][conditionTypeCol] = recordData.condition_type || '';
        }
      }
      
      // ��д���ô�վ�������ֶ�����
      if (closureTypeCol !== -1) data[currentRowIndex][closureTypeCol] = recordData.closure_type || '';
      if (careInstructionsCol !== -1) data[currentRowIndex][careInstructionsCol] = recordData.care_instructions || '';
      if (modelCol !== -1) data[currentRowIndex][modelCol] = processModelForUKAUAE(recordData.model || '');
      if (targetGenderCol !== -1) data[currentRowIndex][targetGenderCol] = recordData.target_gender || '';
      if (recommendedUsesForProductCol !== -1) data[currentRowIndex][recommendedUsesForProductCol] = recordData.recommended_uses_for_product || '';
      if (seasons1Col !== -1) data[currentRowIndex][seasons1Col] = recordData.seasons1 || '';
      if (seasons2Col !== -1) data[currentRowIndex][seasons2Col] = recordData.seasons2 || '';
      if (seasons3Col !== -1) data[currentRowIndex][seasons3Col] = recordData.seasons3 || '';
      if (seasons4Col !== -1) data[currentRowIndex][seasons4Col] = recordData.seasons4 || '';
      if (lifestyle1Col !== -1) data[currentRowIndex][lifestyle1Col] = recordData.lifestyle1 || '';
      if (storageVolumeUnitOfMeasureCol !== -1) {
        let storageVolumeUnit = recordData.storage_volume_unit_of_measure || '';
        // ���ô�վ�����⴦��literת��ΪLiters
        if (actualCountry === 'CA' && storageVolumeUnit.toLowerCase() === 'liter') {
          storageVolumeUnit = 'Liters';
        }
        // Ӣ��վ�����⴦��Litersת��Ϊliter
        if (actualCountry === 'UK' && storageVolumeUnit === 'Liters') {
          storageVolumeUnit = 'liter';
        }
        data[currentRowIndex][storageVolumeUnitOfMeasureCol] = storageVolumeUnit;
      }
      if (storageVolumeCol !== -1) data[currentRowIndex][storageVolumeCol] = recordData.storage_volume || '';
      if (depthFrontToBackCol !== -1) {
        let depthValue = recordData.depth_front_to_back || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (actualCountry === 'CA' && recordData.depth_front_to_back_unit_of_measure && 
            recordData.depth_front_to_back_unit_of_measure.toLowerCase() === 'inches' && 
            depthValue && !isNaN(parseFloat(depthValue))) {
          depthValue = (parseFloat(depthValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (actualCountry === 'UK' && recordData.depth_front_to_back_unit_of_measure && 
            recordData.depth_front_to_back_unit_of_measure === 'Inches' && 
            depthValue && !isNaN(parseFloat(depthValue))) {
          depthValue = (parseFloat(depthValue) * 2.54).toFixed(2);
        }
        data[currentRowIndex][depthFrontToBackCol] = depthValue;
      }
      if (depthFrontToBackUnitOfMeasureCol !== -1) {
        let depthUnit = recordData.depth_front_to_back_unit_of_measure || '';
        console.log(`?? ����depth_front_to_back_unit_of_measure: ԭֵ="${depthUnit}", Ŀ�����="${actualCountry}"`);
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (actualCountry === 'CA' && depthUnit.toLowerCase() === 'inches') {
          depthUnit = 'Centimeters';
          console.log(`?? CA Inchesת��: "${recordData.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
        }
        // Ӣ��վ�����⴦����λת��
        if (actualCountry === 'UK') {
          if (depthUnit === 'Inches') {
            depthUnit = 'Centimetres';
            console.log(`?? UK Inchesת��: "${recordData.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
          } else if (depthUnit === 'Centimeters') {
            depthUnit = 'Centimetres';
            console.log(`?? UK Centimetersת��: "${recordData.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((actualCountry === 'CA' || actualCountry === 'AE' || actualCountry === 'AU') && depthUnit.trim().toLowerCase() === 'centimetres') {
          depthUnit = 'Centimeters';
          console.log(`?? ${actualCountry} Centimetresת��: "${recordData.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
        }
        console.log(`?? ������дdepth_front_to_back_unit_of_measure: "${depthUnit}"`);
        data[currentRowIndex][depthFrontToBackUnitOfMeasureCol] = depthUnit;
      }
                    if (depthWidthSideToSideCol !== -1) {
        let widthValue = recordData.depth_width_side_to_side || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (actualCountry === 'CA' && recordData.depth_width_side_to_side_unit_of_measure && 
            recordData.depth_width_side_to_side_unit_of_measure.toLowerCase() === 'inches' && 
            widthValue && !isNaN(parseFloat(widthValue))) {
          widthValue = (parseFloat(widthValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (actualCountry === 'UK' && recordData.depth_width_side_to_side_unit_of_measure && 
            recordData.depth_width_side_to_side_unit_of_measure === 'Inches' && 
            widthValue && !isNaN(parseFloat(widthValue))) {
          widthValue = (parseFloat(widthValue) * 2.54).toFixed(2);
        }
        data[currentRowIndex][depthWidthSideToSideCol] = widthValue;
      }
      if (depthWidthSideToSideUnitOfMeasureCol !== -1) {
        let widthUnit = recordData.depth_width_side_to_side_unit_of_measure || '';
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (actualCountry === 'CA' && widthUnit.toLowerCase() === 'inches') {
          widthUnit = 'Centimeters';
        }
        // Ӣ��վ�����⴦����λת��
        if (actualCountry === 'UK') {
          if (widthUnit === 'Inches') {
            widthUnit = 'Centimetres';
          } else if (widthUnit === 'Centimeters') {
            widthUnit = 'Centimetres';
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((actualCountry === 'CA' || actualCountry === 'AE' || actualCountry === 'AU') && widthUnit.trim().toLowerCase() === 'centimetres') {
          widthUnit = 'Centimeters';
        }
        data[currentRowIndex][depthWidthSideToSideUnitOfMeasureCol] = widthUnit;
      }
                    if (depthHeightFloorToTopCol !== -1) {
        let heightValue = recordData.depth_height_floor_to_top || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (actualCountry === 'CA' && recordData.depth_height_floor_to_top_unit_of_measure && 
            recordData.depth_height_floor_to_top_unit_of_measure.toLowerCase() === 'inches' && 
            heightValue && !isNaN(parseFloat(heightValue))) {
          heightValue = (parseFloat(heightValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (actualCountry === 'UK' && recordData.depth_height_floor_to_top_unit_of_measure && 
            recordData.depth_height_floor_to_top_unit_of_measure === 'Inches' && 
            heightValue && !isNaN(parseFloat(heightValue))) {
          heightValue = (parseFloat(heightValue) * 2.54).toFixed(2);
        }
        data[currentRowIndex][depthHeightFloorToTopCol] = heightValue;
      }
      if (depthHeightFloorToTopUnitOfMeasureCol !== -1) {
        let heightUnit = recordData.depth_height_floor_to_top_unit_of_measure || '';
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (actualCountry === 'CA' && heightUnit.toLowerCase() === 'inches') {
          heightUnit = 'Centimeters';
        }
        // Ӣ��վ�����⴦����λת��
        if (actualCountry === 'UK') {
          if (heightUnit === 'Inches') {
            heightUnit = 'Centimetres';
          } else if (heightUnit === 'Centimeters') {
            heightUnit = 'Centimetres';
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((actualCountry === 'CA' || actualCountry === 'AE' || actualCountry === 'AU') && heightUnit.trim().toLowerCase() === 'centimetres') {
          heightUnit = 'Centimeters';
        }
        data[currentRowIndex][depthHeightFloorToTopUnitOfMeasureCol] = heightUnit;
      }
      
      // ���ô�վ��manufacturer_contact_information�ֶ����⴦��
      if (manufacturerContactInformationCol !== -1) {
        if (actualCountry === 'CA') {
          // ���ڼ��ô�վ�㣬ͳһ��дָ������������ϵ��Ϣ
          data[currentRowIndex][manufacturerContactInformationCol] = `Shenzhen Xinrong Electronic Commerce Co., LTD
Room 825, Building C, Part C
Qinghu Tech Park
Shenzhen, Longhua, Guangdong 518000
CN
8618123615703`;
        } else {
          // ����վ�㱣��ԭ���߼�
          data[currentRowIndex][manufacturerContactInformationCol] = recordData.manufacturer_contact_information || '';
        }
      }

      // ��дdepartment_name�ֶ�
      if (departmentNameCol !== -1) {
        data[currentRowIndex][departmentNameCol] = processTextForUKAUAE(recordData.department_name || '', 'department_name');
      }
      
      // ���ԣ������һ����¼��д���������
      if (index === 0) {
        console.log('?? ��һ����¼��д���������:', data[currentRowIndex]);
      }
      
      currentRowIndex++;
    });

    console.log(`?? ��д��ɣ�����д�� ${processedRecords.length} ������`);
    
    // ���ԣ�����Ƿ������ݱ���д
    if (processedRecords.length > 0) {
      console.log('?? ���������д���:');
      console.log(`��4������:`, data[3]?.slice(0, 5));
      console.log(`��5������:`, data[4]?.slice(0, 5));
    } else {
      console.log('? ���棺processedRecordsΪ�գ�û�����ݿ���д!');
    }

    // ����8: ����������ת��Ϊ������
    console.log('?? ����Excel�ļ�...');
    const newWorksheet = xlsx.utils.aoa_to_sheet(data);
    
    // ����ԭʼ��������п������
      if (templateWorksheet['!cols']) {
        newWorksheet['!cols'] = templateWorksheet['!cols'];
      }
    if (templateWorksheet['!rows']) {
      newWorksheet['!rows'] = templateWorksheet['!rows'];
    }
    if (templateWorksheet['!merges']) {
      newWorksheet['!merges'] = templateWorksheet['!merges'];
    }
    
    // ���¹�����
    templateWorkbook.Sheets['Template'] = newWorksheet;
    
    try {
      // ����Excel�ļ�buffer
      const outputBuffer = xlsx.write(templateWorkbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        cellStyles: true
      });
      
      console.log(`? Excel�ļ����ɳɹ�����С: ${outputBuffer.length} �ֽ�`);
      
      // �����ļ��������Ҵ���+ĸSKU��ʽ
      console.log('?? ��ʼ�����ļ���...');
      console.log(`?? processedRecords����: ${processedRecords.length}`);
      
      const parentSkus = [...new Set(processedRecords
        .map(record => {
          const parentSku = record.original_parent_sku || (record.item_sku ? record.item_sku.substring(2) : null);
          return parentSku;
        })
        .filter(sku => sku && sku.trim())
      )];
      
      const skuPart = parentSkus.length > 0 ? parentSkus.join('_') : 'DATA';
      const fileName = `${actualCountry}_${skuPart}.xlsx`;
      console.log('?? ���ɵ��ļ���:', fileName);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', outputBuffer.length);
      
      const processingTime = Date.now() - startTime;
      console.log(`? ����${actualCountry}���ϱ�ɹ� (��ʱ: ${processingTime}ms)`);
      
      res.send(outputBuffer);
      
    } catch (fileError) {
      console.error('? Excel�ļ�����ʧ��:', fileError);
      throw new Error('Excel�ļ�����ʧ��: ' + fileError.message);
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error.message || '��������վ�����ϱ�ʱ����δ֪����';
    console.error(`? ��������վ�����ϱ�ʧ�� (��ʱ: ${processingTime}ms):`);
    console.error(`?? ��������: ${error.message}`);
    console.error(`?? �����ջ:`, error.stack);
    console.error(`??? ��������: ${error.name}`);
    
          // �����������Ա����
      console.error(`?? �������: actualCountry=${req.body.country || req.body.targetCountry}, file=${req.file ? req.file.originalname : 'no file'}`);
      
      res.status(500).json({ 
        message: errorMessage,
        processingTime: processingTime,
        error: error.name,
        details: error.stack ? error.stack.split('\n')[0] : 'No stack trace'
      });
    }
  });

// ӳ�����ݵ�ģ��ĸ�������������xlsx�⣩
function mapDataToTemplateXlsx(templateData, records, country) {
  try {
    console.log(`?? ��ʼӳ�� ${records.length} ����¼��${country}ģ��...`);
    
    // ��֤��������
    if (!Array.isArray(templateData) || templateData.length === 0) {
      throw new Error('ģ������Ϊ�ջ��ʽ����');
    }
    
    if (!Array.isArray(records)) {
      throw new Error('��¼���ݸ�ʽ����');
    }
    
    // ����ģ������
    const updatedData = templateData.map(row => [...(row || [])]);
    
    console.log(`?? ģ���� ${updatedData.length} ������`);

    // ������λ�ã��ڵ�3�в��ұ��⣬����Ϊ2��
    let itemSkuCol = -1;
    let itemNameCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;
    let brandNameCol = -1;
    let manufacturerCol = -1;
    let mainImageUrlCol = -1;
    let otherImageUrl1Col = -1;
    let otherImageUrl2Col = -1;
    let otherImageUrl3Col = -1;
    let otherImageUrl4Col = -1;
    let otherImageUrl5Col = -1;
    let otherImageUrl6Col = -1;
    let otherImageUrl7Col = -1;
    let otherImageUrl8Col = -1;
    let productDescriptionCol = -1;
    let bulletPoint1Col = -1;
    let bulletPoint2Col = -1;
    let bulletPoint3Col = -1;
    let bulletPoint4Col = -1;
    let bulletPoint5Col = -1;
    
    // ����ȱʧ�ֶε��б���
    let feedProductTypeCol = -1;
    let externalProductIdTypeCol = -1;
    let quantityCol = -1;
    let ageRangeDescriptionCol = -1;
    let swatchImageUrlCol = -1;
    let relationshipTypeCol = -1;
    let variationThemeCol = -1;
    let parentSkuCol = -1;
    let parentChildCol = -1;
    let styleNameCol = -1;
    let colorMapCol = -1;
    let materialTypeCol = -1;
    let genericKeywordsCol = -1;
    let waterResistanceLevelCol = -1;
    let sizeMapCol = -1;
    let countryOfOriginCol = -1;
    let cpsiaCautionaryStatement1Col = -1;
    let conditionTypeCol = -1;
    
    // ���ô�վ�������ֶε��б���
    let closureTypeCol = -1;
    let careInstructionsCol = -1;
    let modelCol = -1;
    let targetGenderCol = -1;
    let recommendedUsesForProductCol = -1;
    let seasons1Col = -1;
    let seasons2Col = -1;
    let seasons3Col = -1;
    let seasons4Col = -1;
    let lifestyle1Col = -1;
    let storageVolumeUnitOfMeasureCol = -1;
    let storageVolumeCol = -1;
    let depthFrontToBackCol = -1;
    let depthFrontToBackUnitOfMeasureCol = -1;
    let depthWidthSideToSideCol = -1;
    let depthWidthSideToSideUnitOfMeasureCol = -1;
    let depthHeightFloorToTopCol = -1;
    let depthHeightFloorToTopUnitOfMeasureCol = -1;
    let manufacturerContactInformationCol = -1;
    let departmentNameCol = -1;
    
    // ����ȱʧ�ֶε��б���
    let outerMaterialTypeCol = -1;
    let outerMaterialType1Col = -1;
    let liningDescriptionCol = -1;
    let strapTypeCol = -1;
    
    const missingColumns = [];
    
    if (updatedData.length >= 3 && updatedData[2]) {
      updatedData[2].forEach((header, colIndex) => {
        if (header) {
          const cellValue = header.toString().toLowerCase();
          if (cellValue === 'item_sku') {
            itemSkuCol = colIndex;
          } else if (cellValue === 'item_name') {
            itemNameCol = colIndex;
          } else if (cellValue === 'color_name') {
            colorNameCol = colIndex;
          } else if (cellValue === 'size_name') {
            sizeNameCol = colIndex;
          } else if (cellValue === 'brand_name') {
            brandNameCol = colIndex;
          } else if (cellValue === 'manufacturer') {
            manufacturerCol = colIndex;
          } else if (cellValue === 'main_image_url') {
            mainImageUrlCol = colIndex;
          } else if (cellValue === 'other_image_url1') {
            otherImageUrl1Col = colIndex;
          } else if (cellValue === 'other_image_url2') {
            otherImageUrl2Col = colIndex;
          } else if (cellValue === 'other_image_url3') {
            otherImageUrl3Col = colIndex;
          } else if (cellValue === 'other_image_url4') {
            otherImageUrl4Col = colIndex;
          } else if (cellValue === 'other_image_url5') {
            otherImageUrl5Col = colIndex;
          } else if (cellValue === 'other_image_url6') {
            otherImageUrl6Col = colIndex;
          } else if (cellValue === 'other_image_url7') {
            otherImageUrl7Col = colIndex;
          } else if (cellValue === 'other_image_url8') {
            otherImageUrl8Col = colIndex;
          } else if (cellValue === 'product_description') {
            productDescriptionCol = colIndex;
          } else if (cellValue === 'bullet_point1') {
            bulletPoint1Col = colIndex;
          } else if (cellValue === 'bullet_point2') {
            bulletPoint2Col = colIndex;
          } else if (cellValue === 'bullet_point3') {
            bulletPoint3Col = colIndex;
          } else if (cellValue === 'bullet_point4') {
            bulletPoint4Col = colIndex;
          } else if (cellValue === 'bullet_point5') {
            bulletPoint5Col = colIndex;
          } else if (cellValue === 'feed_product_type') {
            feedProductTypeCol = colIndex;
          } else if (cellValue === 'external_product_id_type') {
            externalProductIdTypeCol = colIndex;
          } else if (cellValue === 'quantity') {
            quantityCol = colIndex;
          } else if (cellValue === 'age_range_description') {
            ageRangeDescriptionCol = colIndex;
          } else if (cellValue === 'swatch_image_url') {
            swatchImageUrlCol = colIndex;
          } else if (cellValue === 'relationship_type') {
            relationshipTypeCol = colIndex;
          } else if (cellValue === 'variation_theme') {
            variationThemeCol = colIndex;
          } else if (cellValue === 'parent_sku') {
            parentSkuCol = colIndex;
          } else if (cellValue === 'parent_child') {
            parentChildCol = colIndex;
          } else if (cellValue === 'style_name') {
            styleNameCol = colIndex;
          } else if (cellValue === 'color_map') {
            colorMapCol = colIndex;
          } else if (cellValue === 'material_type') {
            materialTypeCol = colIndex;
          } else if (cellValue === 'generic_keywords') {
            genericKeywordsCol = colIndex;
          } else if (cellValue === 'water_resistance_level') {
            waterResistanceLevelCol = colIndex;
          } else if (cellValue === 'size_map') {
            sizeMapCol = colIndex;
          } else if (cellValue === 'country_of_origin') {
            countryOfOriginCol = colIndex;
          } else if (cellValue === 'cpsia_cautionary_statement1' || cellValue === 'cpsia_cautionary_statement') {
            cpsiaCautionaryStatement1Col = colIndex;
          } else if (cellValue === 'condition_type') {
            conditionTypeCol = colIndex;
          } else if (cellValue === 'closure_type') {
            closureTypeCol = colIndex;
          } else if (cellValue === 'care_instructions') {
            careInstructionsCol = colIndex;
          } else if (cellValue === 'model') {
            modelCol = colIndex;
          } else if (cellValue === 'target_gender') {
            targetGenderCol = colIndex;
          } else if (cellValue === 'recommended_uses_for_product') {
            recommendedUsesForProductCol = colIndex;
          } else if (cellValue === 'seasons1') {
            seasons1Col = colIndex;
          } else if (cellValue === 'seasons2') {
            seasons2Col = colIndex;
          } else if (cellValue === 'seasons3') {
            seasons3Col = colIndex;
          } else if (cellValue === 'seasons4') {
            seasons4Col = colIndex;
          } else if (cellValue === 'lifestyle1') {
            lifestyle1Col = colIndex;
          } else if (cellValue === 'storage_volume_unit_of_measure') {
            storageVolumeUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'storage_volume') {
            storageVolumeCol = colIndex;
          } else if (cellValue === 'depth_front_to_back') {
            depthFrontToBackCol = colIndex;
          } else if (cellValue === 'depth_front_to_back_unit_of_measure') {
            depthFrontToBackUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'depth_width_side_to_side') {
            depthWidthSideToSideCol = colIndex;
          } else if (cellValue === 'depth_width_side_to_side_unit_of_measure') {
            depthWidthSideToSideUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'depth_height_floor_to_top') {
            depthHeightFloorToTopCol = colIndex;
          } else if (cellValue === 'depth_height_floor_to_top_unit_of_measure') {
            depthHeightFloorToTopUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'manufacturer_contact_information') {
            manufacturerContactInformationCol = colIndex;
          } else if (cellValue === 'department_name') {
            departmentNameCol = colIndex;
          } else if (cellValue === 'outer_material_type') {
            outerMaterialTypeCol = colIndex;
          } else if (cellValue === 'outer_material_type1') {
            outerMaterialType1Col = colIndex;
          } else if (cellValue === 'lining_description') {
            liningDescriptionCol = colIndex;
          } else if (cellValue === 'strap_type') {
            strapTypeCol = colIndex;
          }
        }
      });
    }

    // ���ȱʧ����
    const requiredCols = [
      { name: 'item_sku', col: itemSkuCol },
      { name: 'color_name', col: colorNameCol },
      { name: 'size_name', col: sizeNameCol },
      { name: 'brand_name', col: brandNameCol },
    ];
    
    requiredCols.forEach(({ name, col }) => {
      if (col === -1) {
        missingColumns.push(name);
      }
    });
    
    if (missingColumns.length > 0) {
      console.warn(`?? ģ����ȱ��������: ${missingColumns.join(', ')}`);
    }

    console.log(`?? �ҵ���λ�� - item_sku: ${itemSkuCol}, item_name: ${itemNameCol}, color_name: ${colorNameCol}, size_name: ${sizeNameCol}, brand_name: ${brandNameCol}, manufacturer: ${manufacturerCol}`);

    // �ж�Դ�ļ����ͣ�ͨ����һ����¼��SKUǰ׺��
    const sourceCountryType = records.length > 0 && records[0].item_sku ? 
      (records[0].item_sku.startsWith('US') ? 'US_CA' : 'OTHER') : 'OTHER';
    
    console.log(`?? Դ�ļ�����: ${sourceCountryType}, Ŀ�����: ${country}`);

    // �����ı����ݣ�����Դ�ļ���Ŀ����Ҿ���Ʒ���滻����
    const processTextContent = (text, fieldType = 'general') => {
      if (!text) return text;
      
      // ���Ŀ�������Ӣ�����Ĵ����ǡ���������Ӧ�����⴦�����
      if (country === 'UK' || country === 'AU' || country === 'AE') {
        // ����brand_name��manufacturer�ֶΣ�ͳһ����ΪSellerFun
        if (fieldType === 'brand_name' || fieldType === 'manufacturer') {
          return 'SellerFun';
        }
        // ����item_name�ֶΣ������ͷ��JiaYouҪ�滻��SellerFun
        if (fieldType === 'item_name') {
          return text.replace(/^JiaYou/g, 'SellerFun');
        }
        // ����department_name�ֶε����⴦��
        if (fieldType === 'department_name') {
          if (text.trim() === 'Unisex Child') {
            if (country === 'UK' || country === 'AU') {
              return 'Unisex Kids';
            } else if (country === 'AE') {
              return 'unisex-child';
            }
          }
        }
        // �����ı��ֶε�һ�㴦��
        return text.replace(/JiaYou/g, 'SellerFun');
      }
      
      // ���Դ�ļ���������/���ô�����������/���ô����ϱ�ʱ��SellerFun�ĳ�JiaYou
      if (sourceCountryType !== 'US_CA' && (country === 'US' || country === 'CA')) {
        return text.replace(/SellerFun/g, 'JiaYou');
      }
      
      // ���Դ�ļ�������/���ô������ɷ�����/���ô����ϱ�ʱ��JiaYou�ĳ�SellerFun
      if (sourceCountryType === 'US_CA' && country !== 'US' && country !== 'CA') {
        return text.replace(/JiaYou/g, 'SellerFun');
      }
      
      return text;
    };

    // ����ͼƬURL������Դ�ļ���Ŀ����Ҿ����滻����
    const processImageUrl = (url) => {
      if (!url) return url;
      
      // ���Ŀ�������Ӣ�����Ĵ����ǡ���������Ӧ�����⴦�����
      if (country === 'UK' || country === 'AU' || country === 'AE') {
        // �����������pic.jiayou.ink���ĳ�pic.sellerfun.net
        let processedUrl = url.replace(/pic\.jiayou\.ink/g, 'pic.sellerfun.net');
        
        // SKUǰ׺�ĳ�UK (���磺USXBC188 -> UKXBC188)
        processedUrl = processedUrl.replace(/\/US([A-Z0-9]+)\//g, '/UK$1/');
        processedUrl = processedUrl.replace(/\/US([A-Z0-9]+)\./g, '/UK$1.');
        
        return processedUrl;
      }
      
      // ���Դ�ļ���������/���ô�����������/���ô����ϱ�ʱ��JiaYou�ĳ�SellerFun
      if (sourceCountryType !== 'US_CA' && (country === 'US' || country === 'CA')) {
        return url.replace(/JiaYou/g, 'SellerFun');
      }
      
      // ���Դ�ļ�������/���ô������ɷ�����/���ô����ϱ�ʱ��SellerFun�ĳ�JiaYou
      if (sourceCountryType === 'US_CA' && country !== 'US' && country !== 'CA') {
        return url.replace(/SellerFun/g, 'JiaYou');
      }
      
      return url;
    };

    // ����SKU�ֶΣ�����Ŀ����Ҿ���ǰ׺
    const processSkuField = (sku) => {
      if (!sku) return sku;
      
      // ���Ŀ�������Ӣ�����Ĵ����ǡ���������SKUǰ׺��ΪUK
      if (country === 'UK' || country === 'AU' || country === 'AE') {
        return sku.replace(/^[A-Z]{2}/, 'UK');
      }
      
      return sku;
    };

    // ����model�ֶΣ�����Ŀ����Ҿ���ǰ׺
    const processModelField = (model) => {
      if (!model) return model;
      
      // ���Ŀ�������Ӣ�����Ĵ����ǡ���������model�ֶμ���UKǰ׺
      if (country === 'UK' || country === 'AU' || country === 'AE') {
        // ����Ѿ���UKǰ׺�Ͳ��ظ����
        if (model.startsWith('UK')) {
          return model;
        }
        return 'UK' + model;
      }
      
      return model;
    };

    // ���ԣ����ģ��ǰ���е�����
    console.log('?? ģ��ǰ5������:');
    for (let i = 0; i < Math.min(5, updatedData.length); i++) {
      console.log(`��${i + 1}��:`, updatedData[i]?.slice(0, 5) || '����');
    }

    // �����ԭģ�����ݣ�ֻ�ӵ�4�п�ʼ��д����
    const headerRowCount = 3;
    const originalLength = updatedData.length;
    console.log(`?? ����ԭģ���������ݣ��ӵ�${headerRowCount + 1}�п�ʼ��д${records.length}����¼`);
    console.log(`?? ԭģ����${originalLength}�У����ӵ�4�п�ʼ��д����`);

    // ��д�����ݣ��ӵ�4�п�ʼ��
    let addedCount = 0;
    records.forEach((record, index) => {
      const rowIndex = headerRowCount + index;
      
      // ���ԣ������һ����¼����ϸ��Ϣ
      if (index === 0) {
        console.log('?? ��һ����¼����:', {
          item_sku: record.item_sku || record.dataValues?.item_sku,
          item_name: record.item_name || record.dataValues?.item_name,
          brand_name: record.brand_name || record.dataValues?.brand_name,
          dataValues: record.dataValues ? '��dataValues' : '��dataValues'
        });
        console.log(`?? ����д����${rowIndex + 1}�У�����${rowIndex}��`);
      }
      
      // ȷ���д���
      if (!updatedData[rowIndex]) {
        updatedData[rowIndex] = [];
      }
      
      // ȷ�������㹻����
      const maxCol = Math.max(
        itemSkuCol, itemNameCol, colorNameCol, sizeNameCol, brandNameCol, manufacturerCol,
        mainImageUrlCol, otherImageUrl1Col, otherImageUrl2Col, otherImageUrl3Col, 
        otherImageUrl4Col, otherImageUrl5Col, otherImageUrl6Col, otherImageUrl7Col, otherImageUrl8Col, productDescriptionCol,
        bulletPoint1Col, bulletPoint2Col, bulletPoint3Col, bulletPoint4Col, bulletPoint5Col,
        feedProductTypeCol, externalProductIdTypeCol, quantityCol, ageRangeDescriptionCol,
        swatchImageUrlCol, relationshipTypeCol, variationThemeCol, parentSkuCol, parentChildCol,
        styleNameCol, colorMapCol, materialTypeCol, genericKeywordsCol, waterResistanceLevelCol,
        sizeMapCol, countryOfOriginCol, cpsiaCautionaryStatement1Col, conditionTypeCol,
        closureTypeCol, careInstructionsCol, modelCol, targetGenderCol, recommendedUsesForProductCol,
        seasons1Col, seasons2Col, seasons3Col, seasons4Col, lifestyle1Col,
        storageVolumeUnitOfMeasureCol, storageVolumeCol, depthFrontToBackCol, depthFrontToBackUnitOfMeasureCol,
        depthWidthSideToSideCol, depthWidthSideToSideUnitOfMeasureCol, depthHeightFloorToTopCol, 
        depthHeightFloorToTopUnitOfMeasureCol, manufacturerContactInformationCol, departmentNameCol,
        outerMaterialTypeCol, outerMaterialType1Col, liningDescriptionCol, strapTypeCol
      );
      
      for (let i = updatedData[rowIndex].length; i <= maxCol; i++) {
        updatedData[rowIndex][i] = '';
      }

      // ������� - ֧��Sequelizeģ�����ݷ���
      const data = record.dataValues || record;
      
      if (itemSkuCol !== -1) {
        updatedData[rowIndex][itemSkuCol] = processSkuField(data.item_sku || '');
      }
      if (itemNameCol !== -1) {
        updatedData[rowIndex][itemNameCol] = processTextContent(data.item_name, 'item_name') || '';
      }
      if (colorNameCol !== -1) {
        updatedData[rowIndex][colorNameCol] = data.color_name || '';
      }
      if (sizeNameCol !== -1) {
        updatedData[rowIndex][sizeNameCol] = data.size_name || '';
      }
      if (brandNameCol !== -1) {
        updatedData[rowIndex][brandNameCol] = processTextContent(data.brand_name, 'brand_name') || '';
      }
      if (manufacturerCol !== -1) {
        updatedData[rowIndex][manufacturerCol] = processTextContent(data.manufacturer, 'manufacturer') || '';
      }
      if (mainImageUrlCol !== -1) {
        updatedData[rowIndex][mainImageUrlCol] = processImageUrl(data.main_image_url) || '';
      }
      if (otherImageUrl1Col !== -1) {
        updatedData[rowIndex][otherImageUrl1Col] = processImageUrl(data.other_image_url1) || '';
      }
      if (otherImageUrl2Col !== -1) {
        updatedData[rowIndex][otherImageUrl2Col] = processImageUrl(data.other_image_url2) || '';
      }
      if (otherImageUrl3Col !== -1) {
        updatedData[rowIndex][otherImageUrl3Col] = processImageUrl(data.other_image_url3) || '';
      }
      if (otherImageUrl4Col !== -1) {
        updatedData[rowIndex][otherImageUrl4Col] = processImageUrl(data.other_image_url4) || '';
      }
      if (otherImageUrl5Col !== -1) {
        updatedData[rowIndex][otherImageUrl5Col] = processImageUrl(data.other_image_url5) || '';
      }
      if (otherImageUrl6Col !== -1) {
        updatedData[rowIndex][otherImageUrl6Col] = processImageUrl(data.other_image_url6) || '';
      }
      if (otherImageUrl7Col !== -1) {
        updatedData[rowIndex][otherImageUrl7Col] = processImageUrl(data.other_image_url7) || '';
      }
      if (otherImageUrl8Col !== -1) {
        updatedData[rowIndex][otherImageUrl8Col] = processImageUrl(data.other_image_url8) || '';
      }
      if (productDescriptionCol !== -1) {
        updatedData[rowIndex][productDescriptionCol] = processTextContent(data.product_description) || '';
      }
      if (bulletPoint1Col !== -1) {
        updatedData[rowIndex][bulletPoint1Col] = processTextContent(data.bullet_point1) || '';
      }
      if (bulletPoint2Col !== -1) {
        updatedData[rowIndex][bulletPoint2Col] = processTextContent(data.bullet_point2) || '';
      }
      if (bulletPoint3Col !== -1) {
        updatedData[rowIndex][bulletPoint3Col] = processTextContent(data.bullet_point3) || '';
      }
      if (bulletPoint4Col !== -1) {
        updatedData[rowIndex][bulletPoint4Col] = processTextContent(data.bullet_point4) || '';
      }
      if (bulletPoint5Col !== -1) {
        updatedData[rowIndex][bulletPoint5Col] = processTextContent(data.bullet_point5) || '';
      }
      
      // ��д�����ֶ�����
      if (feedProductTypeCol !== -1) {
        updatedData[rowIndex][feedProductTypeCol] = data.feed_product_type || '';
      }
      if (externalProductIdTypeCol !== -1) {
        updatedData[rowIndex][externalProductIdTypeCol] = data.external_product_id_type || '';
      }
      if (quantityCol !== -1) {
        updatedData[rowIndex][quantityCol] = data.quantity || '';
      }
      if (ageRangeDescriptionCol !== -1) {
        updatedData[rowIndex][ageRangeDescriptionCol] = data.age_range_description || '';
      }
      if (swatchImageUrlCol !== -1) {
        updatedData[rowIndex][swatchImageUrlCol] = processImageUrl(data.swatch_image_url) || '';
      }
      if (relationshipTypeCol !== -1) {
        updatedData[rowIndex][relationshipTypeCol] = data.relationship_type || '';
      }
      if (variationThemeCol !== -1) {
        updatedData[rowIndex][variationThemeCol] = data.variation_theme || '';
      }
      if (parentSkuCol !== -1) {
        updatedData[rowIndex][parentSkuCol] = processSkuField(data.parent_sku || '');
      }
      if (parentChildCol !== -1) {
        updatedData[rowIndex][parentChildCol] = data.parent_child || '';
      }
      if (styleNameCol !== -1) {
        updatedData[rowIndex][styleNameCol] = processTextContent(data.style_name) || '';
      }
      if (colorMapCol !== -1) {
        updatedData[rowIndex][colorMapCol] = data.color_map || '';
      }
      if (materialTypeCol !== -1) {
        updatedData[rowIndex][materialTypeCol] = data.material_type || '';
      }
      if (genericKeywordsCol !== -1) {
        updatedData[rowIndex][genericKeywordsCol] = processTextContent(data.generic_keywords) || '';
      }
      if (waterResistanceLevelCol !== -1) {
        updatedData[rowIndex][waterResistanceLevelCol] = data.water_resistance_level || '';
      }
      if (sizeMapCol !== -1) {
        updatedData[rowIndex][sizeMapCol] = data.size_map || '';
      }
      if (countryOfOriginCol !== -1) {
        updatedData[rowIndex][countryOfOriginCol] = data.country_of_origin || '';
      }
      if (cpsiaCautionaryStatement1Col !== -1) {
        // ���ô�վ�����⴦��ʹ���ض���ʽ�ľ������
        if (country === 'CA') {
          updatedData[rowIndex][cpsiaCautionaryStatement1Col] = 'Choking Hazard - Small Parts';
        } else {
          updatedData[rowIndex][cpsiaCautionaryStatement1Col] = 'ChokingHazardSmallParts';
        }
      }
      if (conditionTypeCol !== -1) {
        // ������վ�����⴦��ͳһ��д "new, new"
        if (country === 'AE') {
          updatedData[rowIndex][conditionTypeCol] = 'new, new';
        } else {
          updatedData[rowIndex][conditionTypeCol] = data.condition_type || '';
        }
      }
      
      // ��д���ô�վ�������ֶ�����
      if (closureTypeCol !== -1) {
        updatedData[rowIndex][closureTypeCol] = data.closure_type || '';
      }
      if (careInstructionsCol !== -1) {
        updatedData[rowIndex][careInstructionsCol] = data.care_instructions || '';
      }
      if (modelCol !== -1) {
        updatedData[rowIndex][modelCol] = processModelField(data.model || '');
      }
      if (targetGenderCol !== -1) {
        updatedData[rowIndex][targetGenderCol] = data.target_gender || '';
      }
      if (recommendedUsesForProductCol !== -1) {
        updatedData[rowIndex][recommendedUsesForProductCol] = data.recommended_uses_for_product || '';
      }
      if (seasons1Col !== -1) {
        updatedData[rowIndex][seasons1Col] = data.seasons1 || '';
      }
      if (seasons2Col !== -1) {
        updatedData[rowIndex][seasons2Col] = data.seasons2 || '';
      }
      if (seasons3Col !== -1) {
        updatedData[rowIndex][seasons3Col] = data.seasons3 || '';
      }
      if (seasons4Col !== -1) {
        updatedData[rowIndex][seasons4Col] = data.seasons4 || '';
      }
      if (lifestyle1Col !== -1) {
        updatedData[rowIndex][lifestyle1Col] = data.lifestyle1 || '';
      }
      if (storageVolumeUnitOfMeasureCol !== -1) {
        let storageVolumeUnit = data.storage_volume_unit_of_measure || '';
        // ���ô�վ�����⴦��literת��ΪLiters
        if (country === 'CA' && storageVolumeUnit.toLowerCase() === 'liter') {
          storageVolumeUnit = 'Liters';
        }
        // Ӣ��վ�����⴦��Litersת��Ϊliter
        if (country === 'UK' && storageVolumeUnit === 'Liters') {
          storageVolumeUnit = 'liter';
        }
        updatedData[rowIndex][storageVolumeUnitOfMeasureCol] = storageVolumeUnit;
      }
      if (storageVolumeCol !== -1) {
        updatedData[rowIndex][storageVolumeCol] = data.storage_volume || '';
      }
      if (depthFrontToBackCol !== -1) {
        let depthValue = data.depth_front_to_back || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (country === 'CA' && data.depth_front_to_back_unit_of_measure && 
            data.depth_front_to_back_unit_of_measure.toLowerCase() === 'inches' && 
            depthValue && !isNaN(parseFloat(depthValue))) {
          depthValue = (parseFloat(depthValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (country === 'UK' && data.depth_front_to_back_unit_of_measure && 
            data.depth_front_to_back_unit_of_measure === 'Inches' && 
            depthValue && !isNaN(parseFloat(depthValue))) {
          depthValue = (parseFloat(depthValue) * 2.54).toFixed(2);
        }
        updatedData[rowIndex][depthFrontToBackCol] = depthValue;
      }
      if (depthFrontToBackUnitOfMeasureCol !== -1) {
        let depthUnit = data.depth_front_to_back_unit_of_measure || '';
        console.log(`?? [mapDataToTemplateXlsx] ����depth_front_to_back_unit_of_measure: ԭֵ="${depthUnit}", Ŀ�����="${country}"`);
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (country === 'CA' && depthUnit.toLowerCase() === 'inches') {
          depthUnit = 'Centimeters';
          console.log(`?? [mapDataToTemplateXlsx] CA Inchesת��: "${data.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
        }
        // Ӣ��վ�����⴦����λת��
        if (country === 'UK') {
          if (depthUnit === 'Inches') {
            depthUnit = 'Centimetres';
            console.log(`?? [mapDataToTemplateXlsx] UK Inchesת��: "${data.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
          } else if (depthUnit === 'Centimeters') {
            depthUnit = 'Centimetres';
            console.log(`?? [mapDataToTemplateXlsx] UK Centimetersת��: "${data.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((country === 'CA' || country === 'AE' || country === 'AU') && depthUnit.trim().toLowerCase() === 'centimetres') {
          depthUnit = 'Centimeters';
          console.log(`?? [mapDataToTemplateXlsx] ${country} Centimetresת��: "${data.depth_front_to_back_unit_of_measure}" -> "${depthUnit}"`);
        }
        console.log(`?? [mapDataToTemplateXlsx] ������дdepth_front_to_back_unit_of_measure: "${depthUnit}"`);
        updatedData[rowIndex][depthFrontToBackUnitOfMeasureCol] = depthUnit;
      }
      if (depthWidthSideToSideCol !== -1) {
        let widthValue = data.depth_width_side_to_side || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (country === 'CA' && data.depth_width_side_to_side_unit_of_measure && 
            data.depth_width_side_to_side_unit_of_measure.toLowerCase() === 'inches' && 
            widthValue && !isNaN(parseFloat(widthValue))) {
          widthValue = (parseFloat(widthValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (country === 'UK' && data.depth_width_side_to_side_unit_of_measure && 
            data.depth_width_side_to_side_unit_of_measure === 'Inches' && 
            widthValue && !isNaN(parseFloat(widthValue))) {
          widthValue = (parseFloat(widthValue) * 2.54).toFixed(2);
        }
        updatedData[rowIndex][depthWidthSideToSideCol] = widthValue;
      }
      if (depthWidthSideToSideUnitOfMeasureCol !== -1) {
        let widthUnit = data.depth_width_side_to_side_unit_of_measure || '';
        console.log(`?? [mapDataToTemplateXlsx] ����depth_width_side_to_side_unit_of_measure: ԭֵ="${widthUnit}", Ŀ�����="${country}"`);
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (country === 'CA' && widthUnit.toLowerCase() === 'inches') {
          widthUnit = 'Centimeters';
          console.log(`?? [mapDataToTemplateXlsx] CA Inchesת��: "${data.depth_width_side_to_side_unit_of_measure}" -> "${widthUnit}"`);
        }
        // Ӣ��վ�����⴦����λת��
        if (country === 'UK') {
          if (widthUnit === 'Inches') {
            widthUnit = 'Centimetres';
            console.log(`?? [mapDataToTemplateXlsx] UK Inchesת��: "${data.depth_width_side_to_side_unit_of_measure}" -> "${widthUnit}"`);
          } else if (widthUnit === 'Centimeters') {
            widthUnit = 'Centimetres';
            console.log(`?? [mapDataToTemplateXlsx] UK Centimetersת��: "${data.depth_width_side_to_side_unit_of_measure}" -> "${widthUnit}"`);
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((country === 'CA' || country === 'AE' || country === 'AU') && widthUnit.trim().toLowerCase() === 'centimetres') {
          widthUnit = 'Centimeters';
          console.log(`?? [mapDataToTemplateXlsx] ${country} Centimetresת��: "${data.depth_width_side_to_side_unit_of_measure}" -> "${widthUnit}"`);
        }
        console.log(`?? [mapDataToTemplateXlsx] ������дdepth_width_side_to_side_unit_of_measure: "${widthUnit}"`);
        updatedData[rowIndex][depthWidthSideToSideUnitOfMeasureCol] = widthUnit;
      }
      if (depthHeightFloorToTopCol !== -1) {
        let heightValue = data.depth_height_floor_to_top || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (country === 'CA' && data.depth_height_floor_to_top_unit_of_measure && 
            data.depth_height_floor_to_top_unit_of_measure.toLowerCase() === 'inches' && 
            heightValue && !isNaN(parseFloat(heightValue))) {
          heightValue = (parseFloat(heightValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (country === 'UK' && data.depth_height_floor_to_top_unit_of_measure && 
            data.depth_height_floor_to_top_unit_of_measure === 'Inches' && 
            heightValue && !isNaN(parseFloat(heightValue))) {
          heightValue = (parseFloat(heightValue) * 2.54).toFixed(2);
        }
        updatedData[rowIndex][depthHeightFloorToTopCol] = heightValue;
      }
      if (depthHeightFloorToTopUnitOfMeasureCol !== -1) {
        let heightUnit = data.depth_height_floor_to_top_unit_of_measure || '';
        console.log(`?? [mapDataToTemplateXlsx] ����depth_height_floor_to_top_unit_of_measure: ԭֵ="${heightUnit}", Ŀ�����="${country}"`);
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (country === 'CA' && heightUnit.toLowerCase() === 'inches') {
          heightUnit = 'Centimeters';
          console.log(`?? [mapDataToTemplateXlsx] CA Inchesת��: "${data.depth_height_floor_to_top_unit_of_measure}" -> "${heightUnit}"`);
        }
        // Ӣ��վ�����⴦����λת��
        if (country === 'UK') {
          if (heightUnit === 'Inches') {
            heightUnit = 'Centimetres';
            console.log(`?? [mapDataToTemplateXlsx] UK Inchesת��: "${data.depth_height_floor_to_top_unit_of_measure}" -> "${heightUnit}"`);
          } else if (heightUnit === 'Centimeters') {
            heightUnit = 'Centimetres';
            console.log(`?? [mapDataToTemplateXlsx] UK Centimetersת��: "${data.depth_height_floor_to_top_unit_of_measure}" -> "${heightUnit}"`);
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((country === 'CA' || country === 'AE' || country === 'AU') && heightUnit.trim().toLowerCase() === 'centimetres') {
          heightUnit = 'Centimeters';
          console.log(`?? [mapDataToTemplateXlsx] ${country} Centimetresת��: "${data.depth_height_floor_to_top_unit_of_measure}" -> "${heightUnit}"`);
        }
        console.log(`?? [mapDataToTemplateXlsx] ������дdepth_height_floor_to_top_unit_of_measure: "${heightUnit}"`);
        updatedData[rowIndex][depthHeightFloorToTopUnitOfMeasureCol] = heightUnit;
      }
      
      // ���ô�վ��manufacturer_contact_information�ֶ����⴦��
      if (manufacturerContactInformationCol !== -1) {
        if (country === 'CA') {
          // ���ڼ��ô�վ�㣬ͳһ��дָ������������ϵ��Ϣ
          updatedData[rowIndex][manufacturerContactInformationCol] = `Shenzhen Xinrong Electronic Commerce Co., LTD
Room 825, Building C, Part C
Qinghu Tech Park
Shenzhen, Longhua, Guangdong 518000
CN
8618123615703`;
        } else {
          // ����վ�㱣��ԭ���߼�
          updatedData[rowIndex][manufacturerContactInformationCol] = data.manufacturer_contact_information || '';
        }
      }

      // ��дdepartment_name�ֶ�
      if (departmentNameCol !== -1) {
        updatedData[rowIndex][departmentNameCol] = processTextContent(data.department_name || '', 'department_name');
      }

      // ��дouter_material_type�ֶ�
      if (outerMaterialTypeCol !== -1) {
        updatedData[rowIndex][outerMaterialTypeCol] = data.outer_material_type || '';
      }
      
      // ��дouter_material_type1�ֶΣ��ر����ֶ�ӳ�䣩
      if (outerMaterialType1Col !== -1) {
        // �ֶ�ӳ�����
        // - Ӣ��վ/����վ/������վ��ʹ�� outer_material_type �ֶ�
        // - ����վ/���ô�վʹ�� outer_material_type1 �ֶ�
        // ����Ӣ����վ����������/���ô�վ����ʱ����Ҫ��outer_material_type��ֵӳ�䵽outer_material_type1
        if (sourceCountryType !== 'US_CA' && (country === 'US' || country === 'CA') && data.outer_material_type) {
          updatedData[rowIndex][outerMaterialType1Col] = data.outer_material_type;
        } else {
          updatedData[rowIndex][outerMaterialType1Col] = data.outer_material_type1 || '';
        }
      }

      // ��дlining_description�ֶ�
      if (liningDescriptionCol !== -1) {
        updatedData[rowIndex][liningDescriptionCol] = data.lining_description || '';
      }

      // ��дstrap_type�ֶ�
      if (strapTypeCol !== -1) {
        updatedData[rowIndex][strapTypeCol] = data.strap_type || '';
      }

      addedCount++;
      
      // ���ԣ������һ��������д���������
      if (index === 0 && updatedData[rowIndex]) {
        console.log('?? ��һ��������д�����ǰ5��:', updatedData[rowIndex].slice(0, 5));
      }
    });

    console.log(`? ����ӳ����ɣ������ ${addedCount} �����ݵ�${country}ģ��`);
    
    // ���ԣ�����������ݵ�ǰ����
    console.log('?? ��������ǰ5��:');
    for (let i = 0; i < Math.min(5, updatedData.length); i++) {
      console.log(`��${i + 1}��:`, updatedData[i]?.slice(0, 3) || '����');
    }
    
    // ��֤���ص����ݸ�ʽ
    if (!Array.isArray(updatedData) || updatedData.length === 0) {
      throw new Error('ӳ��������Ϊ��');
    }
    
    // ��֤ÿ�����ݵ�������
    for (let i = 0; i < Math.min(updatedData.length, 5); i++) {
      if (!Array.isArray(updatedData[i])) {
        throw new Error(`��${i}�����ݸ�ʽ����`);
      }
    }
    
    console.log(`?? ����ӳ��������: ${updatedData.length} �� x ${updatedData[0] ? updatedData[0].length : 0} ��`);
    
    return updatedData;
    
  } catch (error) {
    console.error('? ӳ�����ݵ�ģ��ʧ��:');
    console.error(`?? ��������: ${error.message}`);
    console.error(`?? �����ջ:`, error.stack);
    console.error(`??? ��������: ${error.name}`);
    console.error(`?? �������: country=${country}, records����=${Array.isArray(records) ? records.length : 'not array'}, templateData����=${Array.isArray(templateData) ? templateData.length : 'not array'}`);
    throw error;
  }
}

// ������������վ�����ϱ�����Դվ�����ݣ�
router.post('/generate-batch-other-site-datasheet', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('?? �յ�������������վ�����ϱ�����');
    
    const { sourceCountry, targetCountry } = req.body;
    const uploadedFile = req.file;
    
    if (!sourceCountry || !targetCountry || !uploadedFile) {
      return res.status(400).json({ 
        message: '���ṩԴվ�㡢Ŀ��վ����Ϣ��Excel�ļ�' 
      });
    }
    
    if (sourceCountry === targetCountry) {
      return res.status(400).json({ 
        message: 'Դվ���Ŀ��վ�㲻����ͬ' 
      });
    }

    console.log(`?? ������������: ${sourceCountry} -> ${targetCountry}, �ļ�: ${uploadedFile.originalname}`);

    // ���崦�������뵥�����ɺ�������һ�£�
    const processBatchText = (text, fieldType = 'general') => {
      if (!text) return text;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = targetCountry === 'US' || targetCountry === 'CA';
      const targetIsUKAUAE = targetCountry === 'UK' || targetCountry === 'AU' || targetCountry === 'AE';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        if (fieldType === 'brand_name') {
          return 'JiaYou';  // SellerFun -> JiaYou
        }
        if (fieldType === 'manufacturer') {
          return text.replace(/SellerFun/g, 'JiaYou');
        }
        if (fieldType === 'item_name') {
          return text.replace(/SellerFun/g, 'JiaYou');
        }
        return text;
      }
      
      // ����ת���߼�����ԭ��
      return text;
    };

    const processBatchSku = (sku) => {
      if (!sku) return sku;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = targetCountry === 'US' || targetCountry === 'CA';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        // UKǰ׺��ΪUSǰ׺
        return sku.replace(/^UK/, 'US');
      }
      
      return sku;
    };

    const processBatchModel = (model) => {
      if (!model) return model;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = targetCountry === 'US' || targetCountry === 'CA';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        // UKǰ׺��ΪUSǰ׺
        if (model.startsWith('UK')) {
          return model.replace(/^UK/, 'US');
        }
        // ���û��ǰ׺�����USǰ׺
        return 'US' + model;
      }
      
      return model;
    };

    const processBatchImageUrl = (url) => {
      if (!url) return url;
      
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = targetCountry === 'US' || targetCountry === 'CA';
      
      // ��UK/AU/AE����US/CA��ת���߼�
      if (sourceIsUKAUAE && targetIsUSCA) {
        // ������pic.sellerfun.net -> pic.jiayou.ink
        let processedUrl = url.replace(/pic\.sellerfun\.net/g, 'pic.jiayou.ink');
        
        // SKUǰ׺�ĳ�US (���磺UKXBC188 -> USXBC188)
        processedUrl = processedUrl.replace(/\/UK([A-Z0-9]+)\//g, '/US$1/');
        processedUrl = processedUrl.replace(/\/UK([A-Z0-9]+)\./g, '/US$1.');
        
        return processedUrl;
      }
      
      return url;
    };

    // ����1: �����ϴ���Excel�ļ�
    console.log('?? �����ϴ���Excel�ļ�...');
    const workbook = xlsx.read(uploadedFile.buffer);
    
    // ����Ѱ��Template���������û����ʹ�õ�һ��������
    let sheetName;
    let worksheet;
    
    if (workbook.Sheets['Template']) {
      sheetName = 'Template';
      worksheet = workbook.Sheets['Template'];
      console.log('? �ҵ�Template������ʹ��Template������');
    } else {
      sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      console.log(`?? δ�ҵ�Template������ʹ�õ�һ��������: ${sheetName}`);
    }
    
    console.log(`?? ��ǰʹ�õĹ�����: ${sheetName}`);
    
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel�ļ���ʽ����������Ҫ���������к�������' });
    }

    // ����2: ��ȡĿ����ҵ�ģ���ļ�
    console.log(`?? ����${targetCountry}վ���ģ���ļ�...`);
    
    const targetTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: targetCountry,
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!targetTemplate) {
      return res.status(400).json({ 
        message: `δ�ҵ�${targetCountry}վ�������ģ�壬�����ϴ�${targetCountry}ģ���ļ�` 
      });
    }

    console.log(`?? ʹ��${targetCountry}ģ��: ${targetTemplate.file_name} (ID: ${targetTemplate.id})`);

    // ����3: ����Ŀ��ģ���ļ�
    console.log(`?? ����${targetCountry}ģ���ļ�...`);
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const downloadResult = await downloadTemplateFromOSS(targetTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      console.error(`? ����${targetCountry}ģ��ʧ��:`, downloadResult.message);
      return res.status(500).json({ 
        message: `����${targetCountry}ģ��ʧ��: ${downloadResult.message}`,
        details: downloadResult.error
      });
    }

    console.log(`? ${targetCountry}ģ�����سɹ�: ${downloadResult.fileName} (${downloadResult.size} �ֽ�)`);

    // ����4: ��������ת��
    console.log('?? ��ʼ����ת������...');
    const { ProductInformation } = require('../models');
    
    // ��ȡ�����У���3���Ǳ����У�����Ϊ2��
    if (jsonData.length < 4) {
      return res.status(400).json({ message: 'Excel�ļ���ʽ����������Ҫ����ǰ3�б���˵����������' });
    }
    
    const headers = jsonData[2]; // ��3���Ǳ�����
    const dataRows = jsonData.slice(3); // ��4�п�ʼ��������
    
    const transformedRecords = [];
    
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      
      // �������ݶ���
      const rowData = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          rowData[header.toLowerCase().replace(/\s+/g, '_')] = row[index];
        }
      });
      
      // ����original_parent_sku�ֶΣ�����parent_child���жϣ�
      if (rowData.parent_child === 'Parent' && rowData.item_sku && rowData.item_sku.length > 2) {
        // ��parent_childΪ"Parent"ʱ��item_sku�е���ϢΪĸSKU��ȥ��ǰ�����ַ�
        rowData.original_parent_sku = rowData.item_sku.substring(2);
      } else if (rowData.parent_child === 'Child' && rowData.parent_sku && rowData.parent_sku.length > 2) {
        // ��parent_childΪ"Child"ʱ����parent_sku�ֶλ�ȡĸSKU��Ϣ��ȥ��ǰ�����ַ�
        rowData.original_parent_sku = rowData.parent_sku.substring(2);
      } else if (rowData.item_sku && rowData.item_sku.length > 2) {
        // ���ݴ������û��parent_child��Ϣ��ʹ��ԭ���߼�
        rowData.original_parent_sku = rowData.item_sku.substring(2);
        console.warn(`?? ������¼ȱ��parent_child��Ϣ��ʹ��item_sku����original_parent_sku: ${rowData.item_sku} -> ${rowData.original_parent_sku}`);
      }
      
      // �ؼ�ת������Դվ�������ת��ΪĿ��վ�������
      const sourceIsUKAUAE = sourceCountry && (sourceCountry === 'UK' || sourceCountry === 'AU' || sourceCountry === 'AE');
      const targetIsUSCA = targetCountry === 'US' || targetCountry === 'CA';
      
      // SKU�ֶ�ת��
      if (rowData.item_sku && rowData.item_sku.length > 2) {
        if (sourceIsUKAUAE && targetIsUSCA) {
          // ��UK/AU/AE����US/CA��UKǰ׺��ΪUSǰ׺
          rowData.item_sku = rowData.item_sku.replace(/^UK/, 'US');
        } else {
          // ԭ���߼���Ŀ��վ��ǰ׺ + ԭʼSKU�ĺ󲿷�
          rowData.item_sku = targetCountry + rowData.item_sku.substring(2);
        }
      }
      
      // parent_sku�ֶ�ת��
      if (rowData.parent_sku && rowData.parent_sku.length > 2) {
        if (sourceIsUKAUAE && targetIsUSCA) {
          // ��UK/AU/AE����US/CA��UKǰ׺��ΪUSǰ׺
          rowData.parent_sku = rowData.parent_sku.replace(/^UK/, 'US');
        } else {
          // ԭ���߼���Ŀ��վ��ǰ׺ + ԭʼSKU�ĺ󲿷�
          rowData.parent_sku = targetCountry + rowData.parent_sku.substring(2);
        }
      }
      
      // model�ֶ�ת��
      if (rowData.model) {
        if (sourceIsUKAUAE && targetIsUSCA) {
          // ��UK/AU/AE����US/CA��UKǰ׺��ΪUSǰ׺
          if (rowData.model.startsWith('UK')) {
            rowData.model = rowData.model.replace(/^UK/, 'US');
          } else {
            rowData.model = 'US' + rowData.model;
          }
        }
      }
      
      // Ʒ������ת��
      if (sourceIsUKAUAE && targetIsUSCA) {
        if (rowData.brand_name) {
          rowData.brand_name = 'JiaYou';  // SellerFun -> JiaYou
        }
        if (rowData.manufacturer) {
          rowData.manufacturer = rowData.manufacturer.replace(/SellerFun/g, 'JiaYou');
        }
        if (rowData.item_name) {
          rowData.item_name = rowData.item_name.replace(/SellerFun/g, 'JiaYou');
        }
      }
      
      // ͼƬURLת��
      if (sourceIsUKAUAE && targetIsUSCA) {
        const imageFields = [
          'main_image_url', 'other_image_url1', 'other_image_url2', 'other_image_url3', 
          'other_image_url4', 'other_image_url5', 'other_image_url6', 'other_image_url7', 
          'other_image_url8', 'swatch_image_url'
        ];
        
        imageFields.forEach(field => {
          if (rowData[field]) {
            // ������pic.sellerfun.net -> pic.jiayou.ink
            rowData[field] = rowData[field].replace(/pic\.sellerfun\.net/g, 'pic.jiayou.ink');
            
            // SKUǰ׺��UK -> US
            rowData[field] = rowData[field].replace(/\/UK([A-Z0-9]+)\//g, '/US$1/');
            rowData[field] = rowData[field].replace(/\/UK([A-Z0-9]+)\./g, '/US$1.');
          }
        });
      }
      
      // ����site�ֶ�ΪĿ����ң�ת��Ϊ�������ƣ�
      rowData.site = convertCountryCodeToChinese(targetCountry);
      
      transformedRecords.push(rowData);
    }

    console.log(`?? ת���� ${transformedRecords.length} ����¼��SKU��${sourceCountry}ǰ׺ת��Ϊ${targetCountry}ǰ׺`);

    // ����5: ʹ��xlsx�⴦��ģ���ļ����ο�Ӣ�����ϱ����ȷʵ�֣�
    console.log('?? ��ʼʹ��xlsx�⴦��Excel�ļ�...');
    
    // ����ģ���ļ�
    const templateWorkbook = xlsx.read(downloadResult.content, { 
      type: 'buffer',
      cellStyles: true, // ������ʽ
      cellNF: true,     // �������ָ�ʽ
      cellDates: true   // ��������
    });
    
    // ����Ƿ���Template������
    if (!templateWorkbook.Sheets['Template']) {
      return res.status(400).json({ message: 'ģ���ļ���δ�ҵ�Template������' });
    }

    console.log('? �ɹ�����Template������');
    
    const batchTemplateWorksheet = templateWorkbook.Sheets['Template'];
    
    // ��������ת��Ϊ��ά���飬���ڲ���
    const data = xlsx.utils.sheet_to_json(batchTemplateWorksheet, { 
      header: 1, // ʹ��������ʽ
      defval: '', // �յ�Ԫ��Ĭ��ֵ
      raw: false  // ����ԭʼ���ݸ�ʽ
    });
    
    console.log(`?? ��������������: ${data.length}`);

    // ����6: ������λ�ã��ڵ�3�в��ұ��⣬����Ϊ2��
    console.log('?? ������λ��...');
    let itemSkuCol = -1;
    let itemNameCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;
    let brandNameCol = -1;
    let manufacturerCol = -1;
    let mainImageUrlCol = -1;
    let otherImageUrl1Col = -1;
    let otherImageUrl2Col = -1;
    let otherImageUrl3Col = -1;
    let otherImageUrl4Col = -1;
    let otherImageUrl5Col = -1;
    let productDescriptionCol = -1;
    let bulletPoint1Col = -1;
    let bulletPoint2Col = -1;
    let bulletPoint3Col = -1;
    let bulletPoint4Col = -1;
    let bulletPoint5Col = -1;
    
    // ���ô�վ�������ֶε��б���
    let closureTypeCol = -1;
    let careInstructionsCol = -1;
    let modelCol = -1;
    let targetGenderCol = -1;
    let recommendedUsesForProductCol = -1;
    let seasons1Col = -1;
    let seasons2Col = -1;
    let seasons3Col = -1;
    let seasons4Col = -1;
    let lifestyle1Col = -1;
    let storageVolumeUnitOfMeasureCol = -1;
    let storageVolumeCol = -1;
    let depthFrontToBackCol = -1;
    let depthFrontToBackUnitOfMeasureCol = -1;
    let depthWidthSideToSideCol = -1;
    let depthWidthSideToSideUnitOfMeasureCol = -1;
    let depthHeightFloorToTopCol = -1;
    let depthHeightFloorToTopUnitOfMeasureCol = -1;
    let manufacturerContactInformationCol = -1;
    let departmentNameCol = -1;
    
    // ���ȱʧ�ֶε��б���
    let outerMaterialTypeCol = -1;
    let outerMaterialType1Col = -1;
    let liningDescriptionCol = -1;
    let strapTypeCol = -1;
    
    if (data.length >= 3 && data[2]) { // ��3�У�����Ϊ2
      data[2].forEach((header, colIndex) => {
        if (header) {
          const cellValue = header.toString().toLowerCase();
          if (cellValue === 'item_sku') {
            itemSkuCol = colIndex;
          } else if (cellValue === 'item_name') {
            itemNameCol = colIndex;
          } else if (cellValue === 'color_name') {
            colorNameCol = colIndex;
          } else if (cellValue === 'size_name') {
            sizeNameCol = colIndex;
          } else if (cellValue === 'brand_name') {
            brandNameCol = colIndex;
          } else if (cellValue === 'manufacturer') {
            manufacturerCol = colIndex;
          } else if (cellValue === 'main_image_url') {
            mainImageUrlCol = colIndex;
          } else if (cellValue === 'other_image_url1') {
            otherImageUrl1Col = colIndex;
          } else if (cellValue === 'other_image_url2') {
            otherImageUrl2Col = colIndex;
          } else if (cellValue === 'other_image_url3') {
            otherImageUrl3Col = colIndex;
          } else if (cellValue === 'other_image_url4') {
            otherImageUrl4Col = colIndex;
          } else if (cellValue === 'other_image_url5') {
            otherImageUrl5Col = colIndex;
          } else if (cellValue === 'product_description') {
            productDescriptionCol = colIndex;
          } else if (cellValue === 'bullet_point1') {
            bulletPoint1Col = colIndex;
          } else if (cellValue === 'bullet_point2') {
            bulletPoint2Col = colIndex;
          } else if (cellValue === 'bullet_point3') {
            bulletPoint3Col = colIndex;
          } else if (cellValue === 'bullet_point4') {
            bulletPoint4Col = colIndex;
          } else if (cellValue === 'bullet_point5') {
            bulletPoint5Col = colIndex;
          } else if (cellValue === 'closure_type') {
            closureTypeCol = colIndex;
          } else if (cellValue === 'care_instructions') {
            careInstructionsCol = colIndex;
          } else if (cellValue === 'model') {
            modelCol = colIndex;
          } else if (cellValue === 'target_gender') {
            targetGenderCol = colIndex;
          } else if (cellValue === 'recommended_uses_for_product') {
            recommendedUsesForProductCol = colIndex;
          } else if (cellValue === 'seasons1') {
            seasons1Col = colIndex;
          } else if (cellValue === 'seasons2') {
            seasons2Col = colIndex;
          } else if (cellValue === 'seasons3') {
            seasons3Col = colIndex;
          } else if (cellValue === 'seasons4') {
            seasons4Col = colIndex;
          } else if (cellValue === 'lifestyle1') {
            lifestyle1Col = colIndex;
          } else if (cellValue === 'storage_volume_unit_of_measure') {
            storageVolumeUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'storage_volume') {
            storageVolumeCol = colIndex;
          } else if (cellValue === 'depth_front_to_back') {
            depthFrontToBackCol = colIndex;
          } else if (cellValue === 'depth_front_to_back_unit_of_measure') {
            depthFrontToBackUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'depth_width_side_to_side') {
            depthWidthSideToSideCol = colIndex;
          } else if (cellValue === 'depth_width_side_to_side_unit_of_measure') {
            depthWidthSideToSideUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'depth_height_floor_to_top') {
            depthHeightFloorToTopCol = colIndex;
          } else if (cellValue === 'depth_height_floor_to_top_unit_of_measure') {
            depthHeightFloorToTopUnitOfMeasureCol = colIndex;
          } else if (cellValue === 'manufacturer_contact_information') {
            manufacturerContactInformationCol = colIndex;
          } else if (cellValue === 'department_name') {
            departmentNameCol = colIndex;
          } else if (cellValue === 'outer_material_type') {
            outerMaterialTypeCol = colIndex;
          } else if (cellValue === 'outer_material_type1') {
            outerMaterialType1Col = colIndex;
          } else if (cellValue === 'lining_description') {
            liningDescriptionCol = colIndex;
          } else if (cellValue === 'strap_type') {
            strapTypeCol = colIndex;
          }
        }
      });
    }

    console.log(`?? �ҵ���λ�� - item_sku: ${itemSkuCol}, item_name: ${itemNameCol}, color_name: ${colorNameCol}, size_name: ${sizeNameCol}`);

    // ����7: ׼����д����
    console.log('?? ׼����д���ݵ�Excel...');
    
    // ȷ�������������㹻����
    const totalRowsNeeded = 3 + transformedRecords.length; // ǰ3�б��� + ������
    while (data.length < totalRowsNeeded) {
      data.push([]);
    }

    // �ӵ�4�п�ʼ��д���ݣ�����Ϊ3��
    let currentRowIndex = 3; // ��4�п�ʼ������Ϊ3
    
    transformedRecords.forEach((record, index) => {
      // ������Ҫ���������
      const allColumns = [
        itemSkuCol, itemNameCol, colorNameCol, sizeNameCol, brandNameCol, manufacturerCol,
        mainImageUrlCol, otherImageUrl1Col, otherImageUrl2Col, otherImageUrl3Col, 
        otherImageUrl4Col, otherImageUrl5Col, productDescriptionCol,
        bulletPoint1Col, bulletPoint2Col, bulletPoint3Col, bulletPoint4Col, bulletPoint5Col,
        closureTypeCol, careInstructionsCol, modelCol, targetGenderCol, recommendedUsesForProductCol,
        seasons1Col, seasons2Col, seasons3Col, seasons4Col, lifestyle1Col,
        storageVolumeUnitOfMeasureCol, storageVolumeCol, depthFrontToBackCol, depthFrontToBackUnitOfMeasureCol,
        depthWidthSideToSideCol, depthWidthSideToSideUnitOfMeasureCol, depthHeightFloorToTopCol, 
        depthHeightFloorToTopUnitOfMeasureCol, manufacturerContactInformationCol, departmentNameCol,
        outerMaterialTypeCol, outerMaterialType1Col, liningDescriptionCol, strapTypeCol
      ].filter(col => col !== -1);
      const maxCol = Math.max(...allColumns);
      
      // ȷ����ǰ�����㹻����
      if (!data[currentRowIndex]) {
        data[currentRowIndex] = [];
      }
      while (data[currentRowIndex].length <= maxCol) {
        data[currentRowIndex].push('');
      }
      
      // ��д���ݣ�Ӧ��ת��������
      if (itemSkuCol !== -1) data[currentRowIndex][itemSkuCol] = processBatchSku(record.item_sku) || '';
      if (itemNameCol !== -1) data[currentRowIndex][itemNameCol] = processBatchText(record.item_name, 'item_name') || '';
      if (colorNameCol !== -1) data[currentRowIndex][colorNameCol] = record.color_name || '';
      if (sizeNameCol !== -1) data[currentRowIndex][sizeNameCol] = record.size_name || '';
      if (brandNameCol !== -1) data[currentRowIndex][brandNameCol] = processBatchText(record.brand_name, 'brand_name') || '';
      if (manufacturerCol !== -1) data[currentRowIndex][manufacturerCol] = processBatchText(record.manufacturer, 'manufacturer') || '';
      if (mainImageUrlCol !== -1) data[currentRowIndex][mainImageUrlCol] = processBatchImageUrl(record.main_image_url) || '';
      if (otherImageUrl1Col !== -1) data[currentRowIndex][otherImageUrl1Col] = processBatchImageUrl(record.other_image_url1) || '';
      if (otherImageUrl2Col !== -1) data[currentRowIndex][otherImageUrl2Col] = processBatchImageUrl(record.other_image_url2) || '';
      if (otherImageUrl3Col !== -1) data[currentRowIndex][otherImageUrl3Col] = processBatchImageUrl(record.other_image_url3) || '';
      if (otherImageUrl4Col !== -1) data[currentRowIndex][otherImageUrl4Col] = processBatchImageUrl(record.other_image_url4) || '';
      if (otherImageUrl5Col !== -1) data[currentRowIndex][otherImageUrl5Col] = processBatchImageUrl(record.other_image_url5) || '';
      if (productDescriptionCol !== -1) data[currentRowIndex][productDescriptionCol] = record.product_description || '';
      if (bulletPoint1Col !== -1) data[currentRowIndex][bulletPoint1Col] = record.bullet_point1 || '';
      if (bulletPoint2Col !== -1) data[currentRowIndex][bulletPoint2Col] = record.bullet_point2 || '';
      if (bulletPoint3Col !== -1) data[currentRowIndex][bulletPoint3Col] = record.bullet_point3 || '';
      if (bulletPoint4Col !== -1) data[currentRowIndex][bulletPoint4Col] = record.bullet_point4 || '';
      if (bulletPoint5Col !== -1) data[currentRowIndex][bulletPoint5Col] = record.bullet_point5 || '';
      
      // ��д���ô�վ�������ֶ�����
      if (closureTypeCol !== -1) data[currentRowIndex][closureTypeCol] = record.closure_type || '';
      if (careInstructionsCol !== -1) data[currentRowIndex][careInstructionsCol] = record.care_instructions || '';
      if (modelCol !== -1) data[currentRowIndex][modelCol] = processBatchModel(record.model) || '';
      if (targetGenderCol !== -1) data[currentRowIndex][targetGenderCol] = record.target_gender || '';
      if (recommendedUsesForProductCol !== -1) data[currentRowIndex][recommendedUsesForProductCol] = record.recommended_uses_for_product || '';
      if (seasons1Col !== -1) data[currentRowIndex][seasons1Col] = record.seasons1 || '';
      if (seasons2Col !== -1) data[currentRowIndex][seasons2Col] = record.seasons2 || '';
      if (seasons3Col !== -1) data[currentRowIndex][seasons3Col] = record.seasons3 || '';
      if (seasons4Col !== -1) data[currentRowIndex][seasons4Col] = record.seasons4 || '';
      if (lifestyle1Col !== -1) data[currentRowIndex][lifestyle1Col] = record.lifestyle1 || '';
                   if (storageVolumeUnitOfMeasureCol !== -1) {
        let storageVolumeUnit = record.storage_volume_unit_of_measure || '';
        // ���ô�վ�����⴦��literת��ΪLiters
        if (targetCountry === 'CA' && storageVolumeUnit.toLowerCase() === 'liter') {
          storageVolumeUnit = 'Liters';
        }
        // Ӣ��վ�����⴦��Litersת��Ϊliter
        if (targetCountry === 'UK' && storageVolumeUnit === 'Liters') {
          storageVolumeUnit = 'liter';
        }
        data[currentRowIndex][storageVolumeUnitOfMeasureCol] = storageVolumeUnit;
      }
      if (storageVolumeCol !== -1) data[currentRowIndex][storageVolumeCol] = record.storage_volume || '';
      if (depthFrontToBackCol !== -1) {
        let depthValue = record.depth_front_to_back || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (targetCountry === 'CA' && record.depth_front_to_back_unit_of_measure && 
            record.depth_front_to_back_unit_of_measure.toLowerCase() === 'inches' && 
            depthValue && !isNaN(parseFloat(depthValue))) {
          depthValue = (parseFloat(depthValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (targetCountry === 'UK' && record.depth_front_to_back_unit_of_measure && 
            record.depth_front_to_back_unit_of_measure === 'Inches' && 
            depthValue && !isNaN(parseFloat(depthValue))) {
          depthValue = (parseFloat(depthValue) * 2.54).toFixed(2);
        }
        data[currentRowIndex][depthFrontToBackCol] = depthValue;
      }
      if (depthFrontToBackUnitOfMeasureCol !== -1) {
        let depthUnit = record.depth_front_to_back_unit_of_measure || '';
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (targetCountry === 'CA' && depthUnit.toLowerCase() === 'inches') {
          depthUnit = 'Centimeters';
        }
        // Ӣ��վ�����⴦����λת��
        if (targetCountry === 'UK') {
          if (depthUnit === 'Inches') {
            depthUnit = 'Centimetres';
          } else if (depthUnit === 'Centimeters') {
            depthUnit = 'Centimetres';
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((targetCountry === 'CA' || targetCountry === 'AE' || targetCountry === 'AU') && depthUnit.trim().toLowerCase() === 'centimetres') {
          depthUnit = 'Centimeters';
        }
        data[currentRowIndex][depthFrontToBackUnitOfMeasureCol] = depthUnit;
      }
      if (depthWidthSideToSideCol !== -1) {
        let widthValue = record.depth_width_side_to_side || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (targetCountry === 'CA' && record.depth_width_side_to_side_unit_of_measure && 
            record.depth_width_side_to_side_unit_of_measure.toLowerCase() === 'inches' && 
            widthValue && !isNaN(parseFloat(widthValue))) {
          widthValue = (parseFloat(widthValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (targetCountry === 'UK' && record.depth_width_side_to_side_unit_of_measure && 
            record.depth_width_side_to_side_unit_of_measure === 'Inches' && 
            widthValue && !isNaN(parseFloat(widthValue))) {
          widthValue = (parseFloat(widthValue) * 2.54).toFixed(2);
        }
        data[currentRowIndex][depthWidthSideToSideCol] = widthValue;
      }
      if (depthWidthSideToSideUnitOfMeasureCol !== -1) {
        let widthUnit = record.depth_width_side_to_side_unit_of_measure || '';
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (targetCountry === 'CA' && widthUnit.toLowerCase() === 'inches') {
          widthUnit = 'Centimeters';
        }
        // Ӣ��վ�����⴦����λת��
        if (targetCountry === 'UK') {
          if (widthUnit === 'Inches') {
            widthUnit = 'Centimetres';
          } else if (widthUnit === 'Centimeters') {
            widthUnit = 'Centimetres';
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((targetCountry === 'CA' || targetCountry === 'AE' || targetCountry === 'AU') && widthUnit.trim().toLowerCase() === 'centimetres') {
          widthUnit = 'Centimeters';
        }
        data[currentRowIndex][depthWidthSideToSideUnitOfMeasureCol] = widthUnit;
      }
      if (depthHeightFloorToTopCol !== -1) {
        let heightValue = record.depth_height_floor_to_top || '';
        // ���ô�վ�����⴦�������λ��Inches��ת��Ϊ����
        if (targetCountry === 'CA' && record.depth_height_floor_to_top_unit_of_measure && 
            record.depth_height_floor_to_top_unit_of_measure.toLowerCase() === 'inches' && 
            heightValue && !isNaN(parseFloat(heightValue))) {
          heightValue = (parseFloat(heightValue) * 2.54).toFixed(2);
        }
        // Ӣ��վ�����⴦�������λ��Inches��ת��Ϊ����
        if (targetCountry === 'UK' && record.depth_height_floor_to_top_unit_of_measure && 
            record.depth_height_floor_to_top_unit_of_measure === 'Inches' && 
            heightValue && !isNaN(parseFloat(heightValue))) {
          heightValue = (parseFloat(heightValue) * 2.54).toFixed(2);
        }
        data[currentRowIndex][depthHeightFloorToTopCol] = heightValue;
      }
      if (depthHeightFloorToTopUnitOfMeasureCol !== -1) {
        let heightUnit = record.depth_height_floor_to_top_unit_of_measure || '';
        // ���ô�վ�����⴦��Inchesת��ΪCentimeters
        if (targetCountry === 'CA' && heightUnit.toLowerCase() === 'inches') {
          heightUnit = 'Centimeters';
        }
        // Ӣ��վ�����⴦����λת��
        if (targetCountry === 'UK') {
          if (heightUnit === 'Inches') {
            heightUnit = 'Centimetres';
          } else if (heightUnit === 'Centimeters') {
            heightUnit = 'Centimetres';
          }
        }
        // ���ô󡢰��������Ĵ�����վ�����⴦��Centimetresת��ΪCentimeters
        if ((targetCountry === 'CA' || targetCountry === 'AE' || targetCountry === 'AU') && heightUnit.trim().toLowerCase() === 'centimetres') {
          heightUnit = 'Centimeters';
        }
        data[currentRowIndex][depthHeightFloorToTopUnitOfMeasureCol] = heightUnit;
      }
      
      // ���ô�վ��manufacturer_contact_information�ֶ����⴦��
      if (manufacturerContactInformationCol !== -1) {
        if (targetCountry === 'CA') {
          // ���ڼ��ô�վ�㣬ͳһ��дָ������������ϵ��Ϣ
          data[currentRowIndex][manufacturerContactInformationCol] = `Shenzhen Xinrong Electronic Commerce Co., LTD
Room 825, Building C, Part C
Qinghu Tech Park
Shenzhen, Longhua, Guangdong 518000
CN
8618123615703`;
        } else {
          // ����վ�㱣��ԭ���߼�
          data[currentRowIndex][manufacturerContactInformationCol] = record.manufacturer_contact_information || '';
        }
      }

      // ��дdepartment_name�ֶ�
      if (departmentNameCol !== -1) {
        let departmentNameValue = record.department_name || '';
        // ���⴦������Ŀ��վ��ת��department_name�ֶ�
        if (departmentNameValue.trim() === 'Unisex Child') {
          if (targetCountry === 'UK' || targetCountry === 'AU') {
            departmentNameValue = 'Unisex Kids';
          } else if (targetCountry === 'AE') {
            departmentNameValue = 'unisex-child';
          }
        }
        data[currentRowIndex][departmentNameCol] = departmentNameValue;
      }

      // ��дouter_material_type�ֶ�
      if (outerMaterialTypeCol !== -1) {
        data[currentRowIndex][outerMaterialTypeCol] = record.outer_material_type || '';
      }
      
      // ��дouter_material_type1�ֶΣ��ر����ֶ�ӳ�䣩
      if (outerMaterialType1Col !== -1) {
        // �ֶ�ӳ�����
        // - Ӣ��վ/����վ/������վ��ʹ�� outer_material_type �ֶ�
        // - ����վ/���ô�վʹ�� outer_material_type1 �ֶ�
        // ����Ӣ����վ����������/���ô�վ����ʱ����Ҫ��outer_material_type��ֵӳ�䵽outer_material_type1
        if (sourceCountry !== 'US' && sourceCountry !== 'CA' && (targetCountry === 'US' || targetCountry === 'CA') && record.outer_material_type) {
          data[currentRowIndex][outerMaterialType1Col] = record.outer_material_type;
        } else {
          data[currentRowIndex][outerMaterialType1Col] = record.outer_material_type1 || '';
        }
      }

      // ��дlining_description�ֶ�
      if (liningDescriptionCol !== -1) {
        data[currentRowIndex][liningDescriptionCol] = record.lining_description || '';
      }

      // ��дstrap_type�ֶ�
      if (strapTypeCol !== -1) {
        data[currentRowIndex][strapTypeCol] = record.strap_type || '';
      }
      
      currentRowIndex++;
    });

    console.log(`?? ��д��ɣ�����д�� ${transformedRecords.length} ������`);

    // ����8: ����������ת��Ϊ������
    console.log('?? ����Excel�ļ�...');
    const newWorksheet = xlsx.utils.aoa_to_sheet(data);
    
    // ����ԭʼ��������п������
    if (batchTemplateWorksheet['!cols']) {
      newWorksheet['!cols'] = batchTemplateWorksheet['!cols'];
    }
    if (batchTemplateWorksheet['!rows']) {
      newWorksheet['!rows'] = batchTemplateWorksheet['!rows'];
    }
    if (batchTemplateWorksheet['!merges']) {
      newWorksheet['!merges'] = batchTemplateWorksheet['!merges'];
    }
    
    // ���¹�����
    templateWorkbook.Sheets['Template'] = newWorksheet;
    
    try {
      
      // ����Excel�ļ�buffer
      const outputBuffer = xlsx.write(templateWorkbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        cellStyles: true
      });
      
      console.log(`? Excel�ļ����ɳɹ�����С: ${outputBuffer.length} �ֽ�`);
      
      // �����ļ��������Ҵ���+ĸSKU��ʽ
      const parentSkus = [...new Set(transformedRecords
        .map(record => {
          const parentSku = record.original_parent_sku || (record.item_sku ? record.item_sku.substring(2) : null);
          return parentSku;
        })
        .filter(sku => sku && sku.trim())
      )];
      
      const skuPart = parentSkus.length > 0 ? parentSkus.join('_') : 'DATA';
      const fileName = `${targetCountry}_${skuPart}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', outputBuffer.length);
      
      const processingTime = Date.now() - startTime;
      console.log(`? ��������${sourceCountry}��${targetCountry}���ϱ�ɹ� (��ʱ: ${processingTime}ms)`);
      
      res.send(outputBuffer);
      
    } catch (fileError) {
      console.error('? Excel�ļ�����ʧ��:', fileError);
      throw new Error('Excel�ļ�����ʧ��: ' + fileError.message);
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error.message || '������������վ�����ϱ�ʱ����δ֪����';
    console.error(`? ������������վ�����ϱ�ʧ�� (��ʱ: ${processingTime}ms):`);
    console.error(`?? ��������: ${error.message}`);
    console.error(`?? �����ջ:`, error.stack);
    console.error(`??? ��������: ${error.name}`);
    
    // �����������Ա����
    console.error(`?? �������: sourceCountry=${req.body.sourceCountry}, targetCountry=${req.body.targetCountry}, file=${req.file ? req.file.originalname : 'no file'}`);
    
    res.status(500).json({ 
      message: errorMessage,
      processingTime: processingTime,
      error: error.name,
      details: error.stack ? error.stack.split('\n')[0] : 'No stack trace'
    });
  }
});

// ==================== 3������ - ����1���ϴ�Դ���ݵ����ݿ� ====================
router.post('/upload-source-data', upload.single('file'), async (req, res) => {
  try {
    console.log('?? ��ʼ�ϴ�Դ���ݵ����ݿ�...');
    
    const { site } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ message: 'δ���յ��ļ�' });
    }
    
    if (!site) {
      return res.status(400).json({ message: 'δָ��վ��' });
    }
    
    console.log(`?? �����ļ�: ${file.originalname}, վ��: ${site}`);
    
    // ��ȡExcel�ļ�
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    
    // ����Ѱ��Template���������û����ʹ�õ�һ��������
    let sheetName;
    let worksheet;
    
    if (workbook.Sheets['Template']) {
      sheetName = 'Template';
      worksheet = workbook.Sheets['Template'];
      console.log('? �ҵ�Template������ʹ��Template������');
    } else {
      sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      console.log(`?? δ�ҵ�Template������ʹ�õ�һ��������: ${sheetName}`);
    }
    
    console.log(`?? ��ǰʹ�õĹ�����: ${sheetName}`);
    
    // ת��ΪJSON
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel�ļ�������������к�����һ������' });
    }
    
    // ��ȡ�����к������У���3���Ǳ����У�����Ϊ2��
    if (jsonData.length < 4) {
      return res.status(400).json({ message: 'Excel�ļ���ʽ����������Ҫ����ǰ3�б���˵����������' });
    }
    
    const headers = jsonData[2]; // ��3���Ǳ�����
    const dataRows = jsonData.slice(3); // ��4�п�ʼ��������
    
    console.log(`?? �ļ����� ${headers.length} �У�${dataRows.length} ������`);
    
    // Ԥ��������У������ֶ�ӳ��
    const fieldMapping = {};
    const processedHeaders = headers.map((header, index) => {
      if (header) {
        const originalHeader = header.toString();
        const fieldName = originalHeader.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w_]/g, '');
        fieldMapping[index] = { original: originalHeader, processed: fieldName };
        return fieldName;
      }
      return null;
    });
    
    console.log(`?? �ҵ� ${processedHeaders.filter(h => h).length} ����Ч�б���`);
    
    // ת�����ݸ�ʽ
    const records = [];
    let processedRows = 0;
    let skippedRows = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // ����1: ��������Ƿ�Ϊ��
      const hasAnyValue = row.some(cell => cell !== undefined && cell !== null && cell !== '');
      if (!hasAnyValue) {
        skippedRows++;
        continue;
      }
      
      const record = {
        site: convertCountryCodeToChinese(site) // ����վ��Ϊ�������ƣ������created_at��updated_at�ֶ�
      };
      
      let hasItemSku = false;
      let hasOtherValues = false;
      
      // ����2: ӳ��ÿһ�е�����
      for (let j = 0; j < headers.length; j++) {
        const fieldName = processedHeaders[j]; // ʹ��Ԥ������ֶ���
        const cellValue = row[j];
        
        if (fieldName && cellValue !== undefined && cellValue !== null && cellValue !== '') {
          // ���⴦��һЩ�ֶ�
          if (fieldName === 'item_sku' || fieldName === 'sku') {
            record.item_sku = cellValue.toString(); // ת��Ϊ�ַ���
            hasItemSku = true;
          } else {
            // �����ֶ�ֱ�����ã�ֻ�е���ֵʱ��
            record[fieldName] = cellValue;
            hasOtherValues = true;
          }
        }
      }
      
      // ����2.5: ����original_parent_sku������parent_child���жϣ�
      if (record.parent_child === 'Parent' && record.item_sku && record.item_sku.length > 2) {
        // ��parent_childΪ"Parent"ʱ��item_sku�е���ϢΪĸSKU��ȥ��ǰ�����ַ�
        record.original_parent_sku = record.item_sku.substring(2);
      } else if (record.parent_child === 'Child' && record.parent_sku && record.parent_sku.length > 2) {
        // ��parent_childΪ"Child"ʱ����parent_sku�ֶλ�ȡĸSKU��Ϣ��ȥ��ǰ�����ַ�
        record.original_parent_sku = record.parent_sku.substring(2);
      } else if (record.item_sku && record.item_sku.length > 2) {
        // ���ݴ������û��parent_child��Ϣ��ʹ��ԭ���߼�
        record.original_parent_sku = record.item_sku.substring(2);
        console.warn(`?? ���������¼ȱ��parent_child��Ϣ��ʹ��item_sku����original_parent_sku: ${record.item_sku} -> ${record.original_parent_sku}`);
      }
      
      // ����3: ��֤item_sku�ֶ�������
      if (!hasItemSku && hasOtherValues) {
        const errorMsg = `? ��${i + 4}�д���item_sku�ֶ�Ϊ�յ������ֶ���ֵ��item_sku��Ϊ��������Ϊ��`;
        console.error(errorMsg);
        console.error(`?? ����������:`, record);
        return res.status(400).json({ 
          message: errorMsg,
          rowNumber: i + 4,
          rowData: record
        });
      }
      
      if (hasItemSku && !hasOtherValues) {
        const errorMsg = `? ��${i + 4}�д���ֻ��item_sku�ֶ���ֵ�������ֶζ�Ϊ�գ���¼ȱ�ٱ�Ҫ��Ϣ`;
        console.error(errorMsg);
        console.error(`?? ����������:`, record);
        return res.status(400).json({ 
          message: errorMsg,
          rowNumber: i + 4,
          rowData: record
        });
      }
      
      if (!hasItemSku) {
        skippedRows++;
        continue;
      }
      
      records.push(record);
      processedRows++;
    }
    
    console.log(`?? ���ݴ������: ��Ч��¼ ${processedRows} �������� ${skippedRows} ��`);
    
    console.log(`?? ׼������ ${records.length} ����¼��product_information��...`);
    
    // �������浽���ݿ� - ���临������
    try {
      // ����ɾ����ͬվ��ľ�����
      await ProductInformation.destroy({
        where: { site: site }
      });
      
      console.log(`??? ������վ�� ${site} �ľ�����`);
      
      // �����������ݣ���Ϊ���������������ԣ�ʹ��upsert����ȫ��
      let successCount = 0;
      let errorCount = 0;
      
      for (const record of records) {
        try {
          // ���˺���֤���ݣ�ֻ����ģ���ж�����ֶ�
          const filteredRecord = filterValidFields(record);
          
          await ProductInformation.upsert(filteredRecord, {
            returning: false, // �������
            validate: true // ������֤
          });
          successCount++;
        } catch (error) {
          console.error(`? �����¼ʧ��: site=${record.site}, item_sku=${record.item_sku}, ����: ${error.message}`);
          console.error(`ԭʼ�����ֶ�����: ${Object.keys(record).length}, ���˺��ֶ�����: ${Object.keys(filterValidFields(record)).length}`);
          errorCount++;
        }
      }
      
      console.log(`? �ɹ����� ${successCount} ����¼�����ݿ�${errorCount > 0 ? `��${errorCount}��ʧ��` : ''}`);
      
      // ���سɹ���Ӧ
      res.json({
        success: true,
        message: `�ɹ��ϴ� ${successCount} ����¼�����ݿ�${errorCount > 0 ? `��${errorCount}��ʧ��` : ''}`,
        recordCount: successCount,
        errorCount: errorCount,
        site: site,
        fileName: file.originalname
      });
      
    } catch (dbError) {
      console.error('? ���ݿ����ʧ��:', dbError);
      throw new Error('���ݿⱣ��ʧ��: ' + dbError.message);
    }
    
  } catch (error) {
    console.error('? �ϴ�Դ����ʧ��:', error);
    res.status(500).json({
      message: '�ϴ�ʧ��: ' + error.message,
      error: error.toString()
    });
  }
});

// ==================== ����FBASKU���Ͻӿ� ====================

// ����FBASKU����
router.post('/generate-fbasku-data', async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('?? �յ�����FBASKU��������');
    
    const { parentSkus, country } = req.body;
    
    if (!Array.isArray(parentSkus) || parentSkus.length === 0) {
      return res.status(400).json({ message: '���ṩҪ�������ϵ�ĸSKU�б�' });
    }

    if (!country) {
      return res.status(400).json({ message: '��ѡ�����ɵĹ���' });
    }

    console.log(`?? ���� ${parentSkus.length} ��ĸSKU������${country}����:`, parentSkus);

    // ����1: �����ݿ��ȡ��Ӧ���ҵ�ģ���ļ�
    console.log(`?? �����ݿ����${country}ģ���ļ�...`);
    
    const countryTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: country,
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!countryTemplate) {
      return res.status(400).json({ message: `δ�ҵ�${country}վ�������ģ�壬�����ϴ�${country}ģ���ļ�` });
    }

    console.log(`?? ʹ��${country}ģ��: ${countryTemplate.file_name} (ID: ${countryTemplate.id})`);

    // ����2: ����ģ���ļ�
    console.log(`?? ����${country}ģ���ļ�...`);
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const downloadResult = await downloadTemplateFromOSS(countryTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      console.error(`? ����${country}ģ��ʧ��:`, downloadResult.message);
      return res.status(500).json({ 
        message: `����${country}ģ��ʧ��: ${downloadResult.message}`,
        details: downloadResult.error
      });
    }

    console.log(`? ${country}ģ�����سɹ�: ${downloadResult.fileName} (${downloadResult.size} �ֽ�)`);

    // ����3: ������ѯ��SKU��Ϣ
    console.log('?? ������ѯ��SKU��Ϣ...');
    const { sequelize } = require('../models/database');
    
    const inventorySkus = await SellerInventorySku.findAll({
      where: {
        parent_sku: {
          [Op.in]: parentSkus
        }
      },
      order: [['parent_sku', 'ASC'], ['child_sku', 'ASC']]
    });

    if (inventorySkus.length === 0) {
      return res.status(404).json({ 
        message: '�����ݿ���δ�ҵ���ЩĸSKU��Ӧ����SKU��Ϣ' 
      });
    }

    console.log(`?? �ҵ� ${inventorySkus.length} ����SKU��¼`);

    // ����4: ������ѯAmazon SKUӳ��
    const childSkus = inventorySkus.map(item => item.child_sku);
    console.log('?? ������ѯAmazon SKUӳ��...');
    
    let amzSkuMappings = [];
    if (childSkus.length > 0) {
      amzSkuMappings = await sequelize.query(`
        SELECT local_sku, amz_sku, site, country, sku_type 
        FROM pbi_amzsku_sku 
        WHERE local_sku IN (:childSkus) 
          AND sku_type != 'FBA SKU' 
          AND country = :country
      `, {
        replacements: { 
          childSkus: childSkus,
          country: country === 'US' ? '����' : country
        },
        type: sequelize.QueryTypes.SELECT
      });
    }

    console.log(`?? �ҵ� ${amzSkuMappings.length} ��Amazon SKUӳ���¼`);

    // ����5: ������ѯlistings_sku��ȡASIN�ͼ۸���Ϣ
    console.log('?? ������ѯlistings_sku��ȡASIN�ͼ۸���Ϣ...');
    
    let listingsData = [];
    if (amzSkuMappings.length > 0) {
      // ������ѯ��������Ҫƥ��amz_sku��site
      const conditions = amzSkuMappings.map(mapping => 
        `(\`seller-sku\` = '${mapping.amz_sku}' AND site = '${mapping.site}')`
      ).join(' OR ');
      
      console.log(`?? ��ѯ����: ${conditions.length > 200 ? conditions.substring(0, 200) + '...' : conditions}`);
      
      listingsData = await sequelize.query(`
        SELECT \`seller-sku\`, asin1, price, site 
        FROM listings_sku 
        WHERE ${conditions}
      `, {
        type: sequelize.QueryTypes.SELECT
      });
    }

    console.log(`?? �ҵ� ${listingsData.length} ��listings_sku��¼`);

    // ������ѯӳ������߲�ѯЧ��
    const amzSkuMap = new Map();
    amzSkuMappings.forEach(mapping => {
      // ʹ��local_sku��Ϊ��������amz_sku��site��Ϣ
      amzSkuMap.set(mapping.local_sku, {
        amz_sku: mapping.amz_sku,
        site: mapping.site
      });
      console.log(`?? SKUӳ��: ${mapping.local_sku} -> ${mapping.amz_sku} (${mapping.site})`);
    });

    const listingsMap = new Map();
    listingsData.forEach(listing => {
      // ʹ��seller-sku + site��Ϊ���ϼ�
      const compositeKey = `${listing['seller-sku']}_${listing.site}`;
      listingsMap.set(compositeKey, {
        asin: listing.asin1,
        price: listing.price
      });
      console.log(`?? Listings����: ${listing['seller-sku']} (${listing.site}) -> ASIN:${listing.asin1}, Price:${listing.price}`);
    });
    
    console.log(`?? ӳ��ͳ��: amzSkuMap��${amzSkuMap.size}����¼��listingsMap��${listingsMap.size}����¼`);

    // ����6: ���������Լ��
    console.log('?? �������������...');
    
    const missingAmzSkuMappings = []; // ȱ��Amazon SKUӳ�����SKU
    const missingListingsData = [];   // ȱ��Listings���ݵ�Amazon SKU
    
    // ���ÿ����SKU������������
    inventorySkus.forEach(inventory => {
      const childSku = inventory.child_sku;
      const amzSkuInfo = amzSkuMap.get(childSku);
      
      // ����Ƿ�ȱ��Amazon SKUӳ��
      if (!amzSkuInfo) {
        missingAmzSkuMappings.push({
          parentSku: inventory.parent_sku,
          childSku: childSku
        });
        console.log(`? ȱ��Amazon SKUӳ��: ${childSku}`);
      } else {
        // �����Amazon SKUӳ�䣬����Ƿ�ȱ��Listings����
        const compositeKey = `${amzSkuInfo.amz_sku}_${amzSkuInfo.site}`;
        const listingInfo = listingsMap.get(compositeKey);
        if (!listingInfo || !listingInfo.asin || !listingInfo.price) {
          missingListingsData.push({
            parentSku: inventory.parent_sku,
            childSku: childSku,
            amzSku: amzSkuInfo.amz_sku,
            hasAsin: listingInfo?.asin ? true : false,
            hasPrice: listingInfo?.price ? true : false
          });
          console.log(`? ȱ��Listings����: ${amzSku} (��Ӧ��SKU: ${childSku})`);
        }
      }
    });

    // �����������ȱʧ��ֹͣ���ɲ�������ϸ�Ĵ�����Ϣ
    if (missingAmzSkuMappings.length > 0 || missingListingsData.length > 0) {
      const errorInfo = {
        success: false,
        errorType: 'DATA_MISSING',
        missingAmzSkuMappings: missingAmzSkuMappings,
        missingListingsData: missingListingsData,
        message: '���ݲ��������޷�����FBASKU����'
      };
      
      console.log('? ���ݲ�������ֹͣ���ɲ����ش�����Ϣ:', errorInfo);
      
      return res.status(400).json(errorInfo);
    }
    
    console.log('? ���������Լ��ͨ��');

    // ����7: ����Excelģ��
    console.log('?? ��ʼ����Excelģ��...');
    const XLSX = require('xlsx');
    
    const workbook = XLSX.read(downloadResult.content, { 
      type: 'buffer',
      cellStyles: true,
      cellNF: true,
      cellDates: true
    });
    
    console.log('? Excel�ļ��������');
    
    // ����Ƿ���Template������
    if (!workbook.Sheets['Template']) {
      return res.status(400).json({ message: 'ģ���ļ���δ�ҵ�Template������' });
    }

    console.log('? �ɹ�����Template������');
    
    const worksheet = workbook.Sheets['Template'];
    
    // ��������ת��Ϊ��ά����
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      raw: false
    });

    console.log(`?? ģ����������: ${data.length}`);
    
    if (data.length < 3) {
      return res.status(400).json({ message: 'ģ���ʽ����������Ҫ3�����ݣ����������У�' });
    }

    const headerRow = data[2]; // �������Ǳ�����
    console.log('?? ������:', headerRow);

    // �ҵ���Ҫ��д��������
    const columnIndexes = {};
    const requiredColumns = [
      'item_sku', 'update_delete', 'external_product_id', 'external_product_id_type',
      'standard_price', 'fulfillment_center_id', 'package_height', 'package_width',
      'package_length', 'package_length_unit_of_measure', 'package_weight',
      'package_weight_unit_of_measure', 'package_height_unit_of_measure',
      'package_width_unit_of_measure', 'batteries_required',
      'supplier_declared_dg_hz_regulation1', 'condition_type', 'country_of_origin',
      'cpsia_cautionary_statement1'
    ];

    requiredColumns.forEach(col => {
      const index = headerRow.findIndex(header => 
        header && header.toString().toLowerCase() === col.toLowerCase()
      );
      if (index !== -1) {
        columnIndexes[col] = index;
      }
    });

    console.log('?? �ҵ���������:', columnIndexes);

    // ����7: ��д����
    console.log('?? ��ʼ��д����...');
    let dataRowIndex = 3; // �ӵ����п�ʼ��д����

    inventorySkus.forEach((inventory, index) => {
      const childSku = inventory.child_sku;
      const amzSkuInfo = amzSkuMap.get(childSku);
      const listingInfo = amzSkuInfo ? listingsMap.get(`${amzSkuInfo.amz_sku}_${amzSkuInfo.site}`) : null;

      // ȷ�����㹻����
      if (!data[dataRowIndex]) {
        data[dataRowIndex] = new Array(headerRow.length).fill('');
      }

      // ��д��������
      if (columnIndexes['item_sku'] !== undefined) {
        data[dataRowIndex][columnIndexes['item_sku']] = `NA${childSku}`;
      }
      if (columnIndexes['update_delete'] !== undefined) {
        data[dataRowIndex][columnIndexes['update_delete']] = 'PartialUpdate';
      }
      
      // ��ǿexternal_product_id��д�߼�����ӵ�����Ϣ
      if (columnIndexes['external_product_id'] !== undefined) {
        if (listingInfo && listingInfo.asin) {
          data[dataRowIndex][columnIndexes['external_product_id']] = listingInfo.asin;
          console.log(`? ��дASIN: ${childSku} -> ${listingInfo.asin}`);
        } else {
          console.log(`??  ����ASIN��д: ${childSku}, amzSku: ${amzSkuInfo?.amz_sku || 'N/A'}`);
          // ����д��ֵ��ֱ������
        }
      }
      
      if (columnIndexes['external_product_id_type'] !== undefined) {
        data[dataRowIndex][columnIndexes['external_product_id_type']] = 'ASIN';
      }
      
      // ��ǿstandard_price��д�߼�����ӵ�����Ϣ
      if (columnIndexes['standard_price'] !== undefined) {
        if (listingInfo && listingInfo.price) {
          data[dataRowIndex][columnIndexes['standard_price']] = listingInfo.price;
          console.log(`? ��д�۸�: ${childSku} -> ${listingInfo.price}`);
        } else {
          console.log(`??  �����۸���д: ${childSku}, amzSku: ${amzSkuInfo?.amz_sku || 'N/A'}`);
          // ����д��ֵ��ֱ������
        }
      }
      if (columnIndexes['fulfillment_center_id'] !== undefined) {
        data[dataRowIndex][columnIndexes['fulfillment_center_id']] = 'AMAZON_NA';
      }
      if (columnIndexes['package_height'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_height']] = '2';
      }
      if (columnIndexes['package_width'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_width']] = '5';
      }
      if (columnIndexes['package_length'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_length']] = '10';
      }
      if (columnIndexes['package_length_unit_of_measure'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_length_unit_of_measure']] = 'CM';
      }
      if (columnIndexes['package_weight'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_weight']] = '0.5';
      }
      if (columnIndexes['package_weight_unit_of_measure'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_weight_unit_of_measure']] = 'KG';
      }
      if (columnIndexes['package_height_unit_of_measure'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_height_unit_of_measure']] = 'CM';
      }
      if (columnIndexes['package_width_unit_of_measure'] !== undefined) {
        data[dataRowIndex][columnIndexes['package_width_unit_of_measure']] = 'CM';
      }
      if (columnIndexes['batteries_required'] !== undefined) {
        data[dataRowIndex][columnIndexes['batteries_required']] = 'No';
      }
      if (columnIndexes['supplier_declared_dg_hz_regulation1'] !== undefined) {
        data[dataRowIndex][columnIndexes['supplier_declared_dg_hz_regulation1']] = 'Not Applicable';
      }
      if (columnIndexes['condition_type'] !== undefined) {
        // ������վ�����⴦��ͳһ��д "new, new"
        if (country === 'AE') {
          data[dataRowIndex][columnIndexes['condition_type']] = 'new, new';
        } else {
          data[dataRowIndex][columnIndexes['condition_type']] = 'New';
        }
      }
      if (columnIndexes['country_of_origin'] !== undefined) {
        data[dataRowIndex][columnIndexes['country_of_origin']] = 'China';
      }
      if (columnIndexes['cpsia_cautionary_statement1'] !== undefined) {
        // ���ô�վ�����⴦��ʹ���ض���ʽ�ľ������
        if (country === 'CA') {
          data[dataRowIndex][columnIndexes['cpsia_cautionary_statement1']] = 'Choking Hazard - Small Parts';
        } else {
          data[dataRowIndex][columnIndexes['cpsia_cautionary_statement1']] = 'ChokingHazardSmallParts';
        }
      }

      dataRowIndex++;
      
      console.log(`? ������ɵ� ${index + 1}/${inventorySkus.length} ��SKU: ${inventory.parent_sku} -> ${childSku}`);
    });

    // ����8: �����µ�Excel�ļ�
    console.log('?? �����µ�Excel�ļ�...');
    
    const newWorksheet = XLSX.utils.aoa_to_sheet(data);
    workbook.Sheets['Template'] = newWorksheet;
    
    // ����Excel�ļ�������
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellStyles: true
    });

    // �����ļ���
    const fileName = `FBASKU_${country}_${parentSkus.join('_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    console.log(`? FBASKU����������ɣ����� ${inventorySkus.length} ����¼`);
    console.log(`??  �ܺ�ʱ: ${Date.now() - startTime}ms`);

    // �������ɵ�Excel�ļ�
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('? ����FBASKU����ʧ��:', error);
    res.status(500).json({
      message: '����ʧ��: ' + error.message,
      error: error.toString()
    });
  }
});

// ==================== �������Amazon SKUӳ��ӿ� ====================

// �������Amazon SKUӳ�䵽pbi_amzsku_sku��
router.post('/batch-add-amz-sku-mapping', async (req, res) => {
  try {
    console.log('?? �յ��������Amazon SKUӳ������');
    
    const { mappings } = req.body;
    
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ message: '���ṩҪ��ӵ�ӳ������' });
    }

    console.log(`?? ���� ${mappings.length} ��ӳ������:`, mappings);

    // ��֤�����ֶ�
    for (const mapping of mappings) {
      if (!mapping.amz_sku || !mapping.site || !mapping.country || !mapping.local_sku) {
        return res.status(400).json({ 
          message: 'ӳ������ȱ�ٱ����ֶΣ�amz_sku, site, country, local_sku' 
        });
      }
    }

    // ������������
    console.log('?? ��ʼ��������Amazon SKUӳ������...');
    
    const insertPromises = mappings.map(async (mapping) => {
      try {
        // ����Ƿ��Ѵ���
        const existing = await AmzSkuMapping.findOne({
          where: {
            amz_sku: mapping.amz_sku,
            site: mapping.site
          }
        });

        if (existing) {
          console.log(`??  ӳ���Ѵ��ڣ�����: ${mapping.amz_sku} (${mapping.site})`);
          return { success: false, reason: 'ӳ���Ѵ���', mapping };
        }

        // �����¼�¼
        await AmzSkuMapping.create({
          amz_sku: mapping.amz_sku,
          site: mapping.site,
          country: mapping.country,
          local_sku: mapping.local_sku,
          sku_type: mapping.sku_type || 'Local SKU', // Ĭ�����͸�ΪLocal SKU
          update_time: new Date()
        });

        console.log(`? �ɹ�����: ${mapping.local_sku} -> ${mapping.amz_sku}`);
        return { success: true, mapping };
        
      } catch (error) {
        console.error(`? ����ʧ��: ${mapping.local_sku} -> ${mapping.amz_sku}`, error);
        return { success: false, reason: error.message, mapping };
      }
    });

    const results = await Promise.all(insertPromises);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`?? ����������: �ɹ�${successCount}��, ʧ��${failureCount}��`);

    res.json({
      success: true,
      message: `�������Amazon SKUӳ����ɣ��ɹ�${successCount}����ʧ��${failureCount}��`,
      results: {
        successCount,
        failureCount,
        details: results
      }
    });

  } catch (error) {
    console.error('? �������Amazon SKUӳ��ʧ��:', error);
    res.status(500).json({
      message: '�������ʧ��: ' + error.message,
      error: error.toString()
    });
  }
});

// ����ҳ��Դ���루Chrome������ã�
router.post('/save-page-source', async (req, res) => {
  try {
    const { productId, parentSku, weblink, pageSource, sourceLength } = req.body;

    // ��֤��Ҫ����
    if (!productId || !parentSku || !weblink || !pageSource) {
      return res.status(400).json({
        code: 1,
        message: 'ȱ�ٱ�Ҫ����'
      });
    }

    // ���Ҳ�Ʒ��¼
    const product = await ProductWeblink.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        code: 1,
        message: '��Ʒ��¼������'
      });
    }

    // ��֤��Ʒ��Ϣƥ��
    if (product.parent_sku !== parentSku || product.weblink !== weblink) {
      return res.status(400).json({
        code: 1,
        message: '��Ʒ��Ϣ��ƥ��'
      });
    }

    // ����Դ����ժҪ������ǰ1000���ַ���
    const sourceSummary = pageSource.substring(0, 1000);
    
    // ���²�Ʒ��¼��ֻ���¼��ʱ�䣬�����±�ע
    await ProductWeblink.update({
      check_time: new Date()
    }, {
      where: { id: productId }
    });

    // ������Խ�������ҳ��Դ���뱣�浽�ļ�ϵͳ��ר�ŵĴ洢����
    // Ϊ����ʾ������ֻ����Ӧ�з���ժҪ
    console.log(`��Ʒ ${parentSku} ҳ��Դ�����ѻ�ȡ������: ${sourceLength} �ַ�`);

    res.json({
      code: 0,
      message: 'ҳ��Դ���뱣��ɹ�',
      data: {
        productId,
        parentSku,
        sourceLength,
        sourceSummary,
        savedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('����ҳ��Դ����ʧ��:', error);
    res.status(500).json({
      code: 1,
      message: '����ʧ��: ' + error.message
    });
  }
});

// ������������ӣ��ɹ��ã�
router.post('/batch-add-purchase-links', async (req, res) => {
  try {
    const { links } = req.body;
    
    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ message: '�������Ʒ����' });
    }

    const processedLinks = [];
    const errors = [];

    // ��ȡ����֤ÿ������
    for (let i = 0; i < links.length; i++) {
      const rawLink = links[i].trim();
      if (!rawLink) continue;

      // ��ȡ���ӣ���https��ͷ��.html����
      const linkMatch = rawLink.match(/(https:\/\/[^?\s]+\.html)/);
      
      if (linkMatch) {
        const extractedLink = linkMatch[1];
        processedLinks.push(extractedLink);
      } else {
        errors.push({
          line: i + 1,
          originalLink: rawLink,
          error: '���Ӹ�ʽ����δ�ҵ�https��ͷ��html����Ч���Ӳ���'
        });
      }
    }

    // ����д��󣬷��ش�����Ϣ
    if (errors.length > 0 && processedLinks.length === 0) {
      return res.status(400).json({ 
        message: '�������Ӹ�ʽ������ȷ',
        errors: errors
      });
    }

    // ����ظ�����
    const existingLinks = await ProductWeblink.findAll({
      where: {
        weblink: processedLinks
      },
      attributes: ['weblink']
    });

    const existingLinksSet = new Set(existingLinks.map(item => item.weblink));
    const duplicateLinks = [];
    const uniqueLinks = [];

    processedLinks.forEach((link, index) => {
      if (existingLinksSet.has(link)) {
        duplicateLinks.push({
          line: links.findIndex(l => l.includes(link)) + 1,
          originalLink: links.find(l => l.includes(link)),
          extractedLink: link,
          error: '�����Ѵ��������ݿ���'
        });
      } else {
        uniqueLinks.push(link);
      }
    });

    // ׼���������ݣ�ֻ���벻�ظ��ģ�
    const insertData = uniqueLinks.map(link => ({
      weblink: link,
      status: '��Ʒһ��',
      update_time: new Date()
    }));

    // �������뵽���ݿ�
    let createdRecords = [];
    if (insertData.length > 0) {
      createdRecords = await ProductWeblink.bulkCreate(insertData, {
        returning: true
      });
    }

    // �ϲ����д��󣨸�ʽ���� + �ظ�����
    const allErrors = [...errors, ...duplicateLinks];

    // ������Ӧ��Ϣ
    let message = '';
    if (createdRecords.length > 0) {
      message = `�ɹ���� ${createdRecords.length} ���ɹ�����`;
    }
    if (duplicateLinks.length > 0) {
      if (message) message += `������ ${duplicateLinks.length} ���ظ�����`;
      else message = `���� ${duplicateLinks.length} ���ظ�����`;
    }
    if (errors.length > 0) {
      if (message) message += `������ ${errors.length} ����ʽ���������`;
      else message = `���� ${errors.length} ����ʽ���������`;
    }
    if (!message) {
      message = 'û������κ�������';
    }

    res.json({
      message: message,
      data: {
        successCount: createdRecords.length,
        duplicateCount: duplicateLinks.length,
        errorCount: errors.length,
        totalCount: links.length,
        errors: allErrors,
        duplicates: duplicateLinks
      }
    });
  } catch (err) {
    console.error('������Ӳɹ�����ʧ��:', err);
    res.status(500).json({ message: '����������: ' + err.message });
  }
});

// ����Excel�ļ�
router.post('/export-excel', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: 'û�����ݿɵ���' });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('�ɹ����ӹ���');

    // �����б���
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // ���ñ�������ʽ
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    };

    // ���������
    data.forEach(item => {
      const row = headers.map(header => item[header] || '');
      worksheet.addRow(row);
    });

    // �Զ������п�
    headers.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      let maxLength = header.length;
      
      data.forEach(item => {
        const value = item[header] || '';
        if (value.toString().length > maxLength) {
          maxLength = Math.min(value.toString().length, 50); // ���������
        }
      });
      
      column.width = Math.max(maxLength + 2, 10);
    });

    // ������Ӧͷ
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="purchase_links_export.xlsx"');

    // д����Ӧ
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('����Excelʧ��:', error);
    res.status(500).json({ message: '����ʧ��: ' + error.message });
  }
});

// ========== SellerInventorySku���API ==========

// ����parent_sku��ѯSellerInventorySku����
router.get('/seller-inventory-sku/:parentSku', async (req, res) => {
  try {
    const { parentSku } = req.params;
    
    if (!parentSku) {
      return res.status(400).json({
        code: 1,
        message: 'ĸSKU��������Ϊ��'
      });
    }

    console.log('��ѯSellerInventorySku���ݣ�ĸSKU:', parentSku);

    const data = await SellerInventorySku.findAll({
      where: {
        parent_sku: parentSku
      },
      order: [['child_sku', 'ASC']]
    });

    console.log(`��ѯ��${data.length}��SellerInventorySku��¼`);

    res.json({
      code: 0,
      message: '��ѯ�ɹ�',
      data: data
    });

  } catch (error) {
    console.error('��ѯSellerInventorySku����ʧ��:', error);
    res.status(500).json({
      code: 1,
      message: '��ѯʧ��: ' + error.message
    });
  }
});

// ���µ���SellerInventorySku��¼
router.put('/seller-inventory-sku/:skuid', async (req, res) => {
  try {
    const { skuid } = req.params;
    const updateData = req.body;
    
    if (!skuid) {
      return res.status(400).json({
        code: 1,
        message: 'SKU ID��������Ϊ��'
      });
    }

    console.log('����SellerInventorySku��¼��SKU ID:', skuid, '��������:', updateData);

    // ���Ҽ�¼
    const record = await SellerInventorySku.findByPk(skuid);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '��¼������'
      });
    }

    // ���¼�¼
    const [affectedRows] = await SellerInventorySku.update(updateData, {
      where: { skuid: skuid }
    });

    if (affectedRows === 0) {
      return res.status(404).json({
        code: 1,
        message: '����ʧ�ܣ���¼���ܲ�����'
      });
    }

    console.log('SellerInventorySku��¼���³ɹ���Ӱ������:', affectedRows);

    res.json({
      code: 0,
      message: '���³ɹ�'
    });

  } catch (error) {
    console.error('����SellerInventorySku����ʧ��:', error);
    res.status(500).json({
      code: 1,
      message: '����ʧ��: ' + error.message
    });
  }
});

module.exports = router;
