const OSS = require('ali-oss');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// OSS配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  endpoint: process.env.OSS_ENDPOINT,
  secure: true  // 强制使用HTTPS
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
      case 'hscode-images':
        folderPath = `hscode-images/${year}/${month}`;
        break;
      case 'cpc-files':
        folderPath = `cpc-files/${year}/${month}`;
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
    
    // 确保URL使用HTTPS
    let secureUrl = result.url;
    if (secureUrl && secureUrl.startsWith('http://')) {
      secureUrl = secureUrl.replace('http://', 'https://');
      console.log('🔒 将HTTP URL转换为HTTPS:', secureUrl);
    }
    
    return {
      success: true,
      url: secureUrl,
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
    
    // 尝试直接获取文件并生成代理URL
    const url = await client.signatureUrl(objectName, {
      expires: expiresInSeconds,
      method: 'GET',
      'response-content-type': 'application/pdf'
    });
    
    // 确保URL使用HTTPS
    let secureUrl = url;
    if (secureUrl && secureUrl.startsWith('http://')) {
      secureUrl = secureUrl.replace('http://', 'https://');
      console.log('🔒 将签名URL从HTTP转换为HTTPS');
    }
    
    return { success: true, url: secureUrl };
    
  } catch (error) {
    console.error('❌ 获取签名URL失败:', error);
    return { success: false, error: error.message };
  }
}

// 上传模板文件到OSS
async function uploadTemplateToOSS(buffer, filename, templateType, provider = null, country = null) {
  try {
    const client = createOSSClient();
    
    // 生成唯一文件名
    const ext = path.extname(filename);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const uniqueName = `${timestamp}-${filename}`;
    
    // 构建文件路径
    let folderPath;
    switch (templateType) {
      case 'amazon':
        folderPath = `templates/excel/amazon/${country || 'default'}`;
        break;
      case 'logistics':
        const providerFolder = provider ? provider.toLowerCase().replace(/[^a-z0-9]/g, '') : 'others';
        folderPath = `templates/excel/logistics/${providerFolder}/${country || 'default'}`;
        break;
      case 'packing-list':
        folderPath = `templates/excel/packing-list`;
        break;
      default:
        folderPath = `templates/excel/others`;
    }
    
    const objectName = `${folderPath}/${uniqueName}`;
    
    // 设置Content-Type
    let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext.toLowerCase() === '.xls') {
      contentType = 'application/vnd.ms-excel';
    }
    
    // 上传文件
    const result = await client.put(objectName, buffer, {
      headers: {
        'Content-Type': contentType,
        'x-oss-storage-class': 'Standard'
      }
    });
    
    console.log('✅ 模板文件上传成功:', result.name);
    
    // 确保URL使用HTTPS
    let secureUrl = result.url;
    if (secureUrl && secureUrl.startsWith('http://')) {
      secureUrl = secureUrl.replace('http://', 'https://');
      console.log('🔒 将HTTP URL转换为HTTPS:', secureUrl);
    }
    
    return {
      success: true,
      url: secureUrl,
      name: result.name,
      size: buffer.length,
      originalName: filename,
      uniqueName: uniqueName,
      folder: folderPath,
      templateType: templateType,
      provider: provider,
      country: country
    };
    
  } catch (error) {
    console.error('❌ 模板文件上传失败:', error);
    throw error;
  }
}

// 获取模板文件列表
async function listTemplateFiles(templateType, provider = null, country = null) {
  try {
    const client = createOSSClient();
    
    // 构建搜索前缀
    let prefix;
    switch (templateType) {
      case 'amazon':
        prefix = country ? `templates/excel/amazon/${country}/` : `templates/excel/amazon/`;
        break;
      case 'logistics':
        if (provider && country) {
          const providerFolder = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
          prefix = `templates/excel/logistics/${providerFolder}/${country}/`;
        } else if (provider) {
          const providerFolder = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
          prefix = `templates/excel/logistics/${providerFolder}/`;
        } else {
          prefix = `templates/excel/logistics/`;
        }
        break;
      case 'packing-list':
        prefix = `templates/excel/packing-list/`;
        break;
      default:
        prefix = `templates/excel/others/`;
    }
    
    const result = await client.list({
      prefix: prefix,
      'max-keys': 100
    });
    
    // 过滤掉 placeholder 文件，只返回实际的模板文件
    const templateFiles = (result.objects || [])
      .filter(obj => !obj.name.includes('.placeholder') && obj.name !== prefix)
      .map(obj => ({
        name: obj.name,
        size: obj.size,
        lastModified: obj.lastModified,
        url: `https://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT}/${obj.name}`,
        fileName: obj.name.split('/').pop(),
        folder: obj.name.replace(/\/[^\/]+$/, '/')
      }));
    
    return {
      success: true,
      files: templateFiles,
      count: templateFiles.length
    };
    
  } catch (error) {
    console.error('❌ 获取模板文件列表失败:', error);
    throw error;
  }
}

// 下载模板文件
async function downloadTemplateFromOSS(objectName) {
  try {
    const client = createOSSClient();
    
    // 检查文件是否存在
    try {
      await client.head(objectName);
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        throw new Error('模板文件不存在');
      }
      throw error;
    }
    
    // 获取文件内容
    const result = await client.get(objectName);
    
    return {
      success: true,
      content: result.content,
      fileName: objectName.split('/').pop(),
      size: result.res.size || 0,
      contentType: result.res.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
  } catch (error) {
    console.error('❌ 下载模板文件失败:', error);
    throw error;
  }
}

// 删除模板文件
async function deleteTemplateFromOSS(objectName) {
  try {
    const client = createOSSClient();
    
    await client.delete(objectName);
    console.log('✅ 模板文件删除成功:', objectName);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ 模板文件删除失败:', error);
    
    if (error.code === 'AccessDenied') {
      return { 
        success: false, 
        error: 'AccessDenied', 
        message: '删除权限不足' 
      };
    }
    
    throw error;
  }
}

// 备份模板文件
async function backupTemplate(objectName, templateType) {
  try {
    const client = createOSSClient();
    
    // 构建备份路径
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = objectName.split('/').pop();
    const backupPath = `templates/backup/${templateType}/${timestamp}-${fileName}`;
    
    // 复制文件到备份位置
    await client.copy(backupPath, objectName);
    
    console.log('✅ 模板文件备份成功:', backupPath);
    
    return {
      success: true,
      backupPath: backupPath,
      originalPath: objectName
    };
    
  } catch (error) {
    console.error('❌ 模板文件备份失败:', error);
    throw error;
  }
}

module.exports = {
  uploadToOSS,
  deleteFromOSS,
  getSignedUrl,
  checkOSSConfig,
  createOSSClient,
  uploadTemplateToOSS,
  listTemplateFiles,
  downloadTemplateFromOSS,
  deleteTemplateFromOSS,
  backupTemplate
}; 