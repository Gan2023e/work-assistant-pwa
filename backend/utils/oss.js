const OSS = require('ali-oss');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// OSS配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  endpoint: process.env.OSS_ENDPOINT
};

// 检查必要的环境变量
function checkOSSConfig() {
  const required = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('⚠️ OSS配置缺失，以下环境变量需要配置:', missing.join(', '));
    return false;
  }
  
  return true;
}

// 创建OSS客户端
function createOSSClient() {
  if (!checkOSSConfig()) {
    throw new Error('OSS配置不完整');
  }
  
  return new OSS(ossConfig);
}

// 上传文件到OSS
async function uploadToOSS(buffer, filename, folder = 'purchase') {
  try {
    const client = createOSSClient();
    
    // 生成唯一文件名
    const ext = path.extname(filename);
    const uniqueName = `${uuidv4()}${ext}`;
    
    // 构建文件路径：invoices/类型/年份/月份/文件名
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    let folderPath;
    switch (folder) {
      case 'purchase':
        folderPath = `invoices/purchase/${year}/${month}`;
        break;
      case 'sales':
        folderPath = `invoices/sales/${year}/${month}`;
        break;
      case 'temp':
        folderPath = `invoices/temp`;
        break;
      case 'archive':
        folderPath = `invoices/archive/${year}`;
        break;
      default:
        // 默认使用采购发票路径
        folderPath = `invoices/purchase/${year}/${month}`;
    }
    
    const objectName = `${folderPath}/${uniqueName}`;
    
    // 根据文件类型设置Content-Type
    let contentType = 'application/octet-stream';
    if (ext.toLowerCase() === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext.toLowerCase() === '.png') {
      contentType = 'image/png';
    }
    
    // 上传文件
    const result = await client.put(objectName, buffer, {
      headers: {
        'Content-Type': contentType,
        'x-oss-storage-class': 'Standard'
      }
    });
    
    console.log('✅ 文件上传成功:', result.name);
    
    return {
      success: true,
      url: result.url,
      name: result.name,
      size: buffer.length,
      originalName: filename,
      folder: folderPath
    };
    
  } catch (error) {
    console.error('❌ 文件上传失败:', error);
    throw error;
  }
}

// 删除OSS文件
async function deleteFromOSS(objectName) {
  try {
    const client = createOSSClient();
    
    await client.delete(objectName);
    console.log('✅ 文件删除成功:', objectName);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ 文件删除失败:', error);
    
    // 如果是权限问题，记录警告但不抛出错误
    if (error.code === 'AccessDenied') {
      console.warn('⚠️ 删除权限不足，请检查AccessKey权限或Bucket ACL设置');
      return { 
        success: false, 
        error: 'AccessDenied', 
        message: '删除权限不足' 
      };
    }
    
    throw error;
  }
}

// 获取文件签名URL（用于访问私有文件）
async function getSignedUrl(objectName, expiresInSeconds = 3600) {
  try {
    const client = createOSSClient();
    
    const url = client.signatureUrl(objectName, {
      expires: expiresInSeconds
    });
    
    return { success: true, url };
    
  } catch (error) {
    console.error('❌ 获取签名URL失败:', error);
    throw error;
  }
}

module.exports = {
  uploadToOSS,
  deleteFromOSS,
  getSignedUrl,
  checkOSSConfig
}; 