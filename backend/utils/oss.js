const OSS = require('ali-oss');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 动态分片配置函数
function getOptimalUploadConfig(fileSize, connectionType = 'auto') {
  // 文件大小分类
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  
  let config = {
    partSize: 1 * MB,
    parallel: 4,
    useMultipart: fileSize > 5 * MB
  };
  
  if (fileSize <= 10 * MB) {
    // 小文件：直接上传，不分片
    config = {
      partSize: fileSize,
      parallel: 1,
      useMultipart: false
    };
  } else if (fileSize <= 100 * MB) {
    // 中等文件：1MB分片，4-6并发
    config = {
      partSize: 1 * MB,
      parallel: Math.min(6, Math.ceil(fileSize / (10 * MB))),
      useMultipart: true
    };
  } else if (fileSize <= 500 * MB) {
    // 大文件：2-5MB分片，6-8并发
    config = {
      partSize: Math.min(5 * MB, Math.max(2 * MB, Math.floor(fileSize / 100))),
      parallel: 8,
      useMultipart: true
    };
  } else if (fileSize <= 2 * GB) {
    // 超大文件：5-10MB分片，8-10并发
    config = {
      partSize: Math.min(10 * MB, Math.max(5 * MB, Math.floor(fileSize / 200))),
      parallel: 10,
      useMultipart: true
    };
  } else {
    // 巨大文件：10MB分片，10并发
    config = {
      partSize: 10 * MB,
      parallel: 10,
      useMultipart: true
    };
  }
  
  // 根据连接类型调整
  switch (connectionType) {
    case 'slow':
      config.parallel = Math.max(1, Math.floor(config.parallel / 2));
      config.partSize = Math.max(512 * 1024, Math.floor(config.partSize / 2));
      break;
    case 'fast':
      config.parallel = Math.min(12, Math.floor(config.parallel * 1.5));
      break;
  }
  
  return config;
}

// OSS配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  endpoint: process.env.OSS_ENDPOINT,
  secure: true,  // 强制使用HTTPS
  timeout: 300000, // 修复：增加到5分钟（300秒）超时，支持大文件上传
  // 分片上传专用配置
  requestTimeout: 300000, // 请求超时（5分钟）
  responseTimeout: 300000, // 响应超时（5分钟）
  // 默认分片上传配置（会被动态配置覆盖）
  partSize: 1024 * 1024, // 1MB 分片大小
  parallel: 4, // 并发上传数
  checkPointRebuild: false, // 不重建检查点
  // 性能优化配置
  retryCountMax: 3, // 最大重试次数
  retryDelayMax: 2000 // 最大重试延迟
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
    
    console.log(`📤 开始上传模板文件: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    
    // 修复：正确处理中文文件名编码
    const originalName = Buffer.isBuffer(filename) ? filename.toString('utf8') : filename;
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    
    console.log(`📝 原始文件名: ${originalName}`);
    console.log(`📝 文件扩展名: ${ext}`);
    console.log(`📝 文件名（无扩展名）: ${nameWithoutExt}`);
    
    // 生成唯一文件名，使用安全的文件名格式
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = nameWithoutExt.replace(/[<>:"/\\|?*]/g, '_'); // 替换特殊字符
    const uniqueName = `${timestamp}-${safeName}${ext}`;
    
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
    console.log(`📁 目标路径: ${objectName}`);
    
    // 设置Content-Type
    let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext.toLowerCase() === '.xls') {
      contentType = 'application/vnd.ms-excel';
    } else if (ext.toLowerCase() === '.xlsm') {
      contentType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
    }
    
    // 选择上传方式：智能动态配置
    let result;
    const fileSize = buffer.length;
    
    // 获取最优配置
    const uploadConfig = getOptimalUploadConfig(fileSize);
    console.log(`🎯 智能配置: 文件大小=${(fileSize/1024/1024).toFixed(1)}MB, 分片=${(uploadConfig.partSize/1024/1024).toFixed(1)}MB, 并发=${uploadConfig.parallel}`);
    
    if (uploadConfig.useMultipart) {
      console.log('🚀 使用智能分片上传');
      
      result = await client.multipartUpload(objectName, buffer, {
        partSize: uploadConfig.partSize,
        parallel: uploadConfig.parallel,
        progress: (percentage, checkpoint) => {
          console.log(`📊 上传进度: ${Math.round(percentage * 100)}%`);
        },
        meta: {
          'original-name': Buffer.from(originalName, 'utf8').toString('base64'),  // 修复：使用base64编码保存原始文件名
          'upload-time': new Date().toISOString(),
          'file-size': fileSize.toString(),
          'template-type': templateType
        },
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`  // 修复：正确的UTF-8文件名编码
        }
      });
    } else {
      console.log('⚡ 使用直接上传');
      
      result = await client.put(objectName, buffer, {
        meta: {
          'original-name': Buffer.from(originalName, 'utf8').toString('base64'),  // 修复：使用base64编码保存原始文件名
          'upload-time': new Date().toISOString(),
          'file-size': fileSize.toString(),
          'template-type': templateType
        },
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`  // 修复：正确的UTF-8文件名编码
        }
      });
    }
    
    console.log('✅ 模板文件上传成功:', objectName);
    
    return {
      success: true,
      name: objectName,
      originalName: originalName,  // 返回原始文件名
      url: result.url,
      size: fileSize
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
    
    // 过滤掉 placeholder 文件，只返回实际的模板文件，并从元数据恢复原始文件名
    const templateFiles = [];
    
    for (const obj of (result.objects || [])) {
      if (!obj.name.includes('.placeholder') && obj.name !== prefix) {
        let displayFileName = obj.name.split('/').pop();
        
        try {
          // 修复：尝试从OSS元数据获取原始文件名
          const objectMeta = await client.head(obj.name);
          if (objectMeta.meta && objectMeta.meta['original-name']) {
            const originalNameBase64 = objectMeta.meta['original-name'];
            displayFileName = Buffer.from(originalNameBase64, 'base64').toString('utf8');
            console.log(`📁 从元数据恢复文件名: ${obj.name} -> ${displayFileName}`);
          } else {
            console.log(`⚠️ 文件缺少原始文件名元数据: ${obj.name}`);
            
            // 兼容性处理：为旧文件（没有元数据的）尝试提取可读文件名
            const rawFileName = obj.name.split('/').pop();
            
            // 如果文件名包含乱码，尝试提取有意义的部分
            if (rawFileName.includes('è±') || rawFileName.includes('æ') || rawFileName.includes('ã')) {
              // 尝试从乱码文件名中提取版本号或扩展名
              const versionMatch = rawFileName.match(/(Version[\d.]+)/);
              const extMatch = rawFileName.match(/(\.[a-zA-Z]+)$/);
              const timestampMatch = rawFileName.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
              
              let friendlyName = '英国资料表模板';
              
              if (timestampMatch) {
                const timestamp = timestampMatch[1].replace('T', ' ').replace(/-/g, ':');
                friendlyName += `_${timestamp}`;
              }
              
              if (versionMatch) {
                friendlyName += `_${versionMatch[1]}`;
              }
              
              if (extMatch) {
                friendlyName += extMatch[1];
              } else {
                friendlyName += '.xlsm'; // 默认扩展名
              }
              
              displayFileName = friendlyName;
              console.log(`🔧 为乱码文件生成友好名称: ${rawFileName} -> ${displayFileName}`);
            }
          }
        } catch (metaError) {
          console.warn(`⚠️ 获取文件元数据失败: ${obj.name}`, metaError.message);
          
          // 如果获取元数据失败，也尝试生成一个友好的文件名
          const rawFileName = obj.name.split('/').pop();
          if (rawFileName.includes('è±') || rawFileName.includes('æ') || rawFileName.includes('ã')) {
            displayFileName = `英国资料表模板_${new Date(obj.lastModified).toLocaleDateString().replace(/\//g, '-')}.xlsm`;
            console.log(`🔧 为问题文件生成默认名称: ${rawFileName} -> ${displayFileName}`);
          }
        }
        
        templateFiles.push({
          name: obj.name,  // OSS完整路径，用于删除
          size: obj.size,
          lastModified: obj.lastModified,
          url: `https://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT}/${obj.name}`,
          fileName: displayFileName,  // 修复：显示原始文件名
          folder: obj.name.replace(/\/[^\/]+$/, '/')
        });
      }
    }
    
    console.log(`📋 找到 ${templateFiles.length} 个模板文件`);
    
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
    
    console.log(`📥 开始流式下载文件: ${objectName}`);
    
    // 检查文件是否存在并获取元数据
    let headResult;
    try {
      headResult = await client.head(objectName);
      console.log(`✅ 文件存在: ${objectName}`);
      console.log(`📊 文件大小: ${headResult.res.headers['content-length']} 字节`);
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        console.error(`❌ 文件不存在: ${objectName}`);
        return { success: false, message: '模板文件不存在' };
      }
      throw error;
    }
    
    // 修复：使用流式下载替代直接get，确保二进制文件完整性
    console.log('🌊 使用流式下载获取文件内容');
    const stream = await client.getStream(objectName);
    
    console.log(`📥 开始读取流数据`);
    console.log(`📋 Stream Content-Type: ${stream.res.headers['content-type']}`);
    
    // 将流转换为Buffer
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.stream.on('data', (chunk) => {
        chunks.push(chunk);
        console.log(`📦 接收数据块: ${chunk.length} 字节`);
      });
      
      stream.stream.on('end', () => {
        try {
          // 合并所有数据块
          const content = Buffer.concat(chunks);
          console.log(`✅ 流下载完成: 总大小 ${content.length} 字节`);
          
          // 获取原始文件名（从metadata中获取）
          let originalFileName = objectName.split('/').pop();
          try {
            const originalNameMeta = headResult.res.headers['x-oss-meta-original-name'];
            if (originalNameMeta) {
              originalFileName = Buffer.from(originalNameMeta, 'base64').toString('utf8');
              console.log(`📝 从元数据获取原始文件名: ${originalFileName}`);
            }
          } catch (e) {
            console.log('⚠️ 无法从元数据获取原始文件名，使用objectName');
          }
          
          // 根据文件扩展名设置正确的Content-Type
          const ext = originalFileName.toLowerCase().split('.').pop();
          let contentType = 'application/octet-stream'; // 默认二进制流
          
          switch (ext) {
            case 'xlsx':
              contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              break;
            case 'xls':
              contentType = 'application/vnd.ms-excel';
              break;
            case 'xlsm':
              contentType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
              break;
            default:
              contentType = stream.res.headers['content-type'] || 'application/octet-stream';
          }
          
          console.log(`✅ 流式下载成功: ${originalFileName} (${content.length} 字节)`);
          
          resolve({
            success: true,
            content: content,  // 确保返回Buffer
            fileName: originalFileName,
            size: content.length,
            contentType: contentType
          });
          
        } catch (error) {
          console.error('❌ 处理流数据失败:', error);
          reject(error);
        }
      });
      
      stream.stream.on('error', (error) => {
        console.error('❌ 流下载失败:', error);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('❌ 流式下载模板文件失败:', error);
    return { success: false, message: error.message };
  }
}

// 删除模板文件
async function deleteTemplateFromOSS(objectName) {
  try {
    const client = createOSSClient();
    
    console.log(`🗑️ 准备删除文件: ${objectName}`);
    
    // 修复：添加详细的删除日志
    try {
      // 先检查文件是否存在
      const headResult = await client.head(objectName);
      console.log(`✅ 文件存在，开始删除: ${objectName}`);
      console.log(`📄 文件信息: 大小=${headResult.res.headers['content-length']}字节, 最后修改=${headResult.res.headers['last-modified']}`);
    } catch (headError) {
      console.error(`❌ 文件不存在或无法访问: ${objectName}`, headError.message);
      return { 
        success: false, 
        error: 'FileNotFound', 
        message: '文件不存在或无法访问' 
      };
    }
    
    // 执行删除
    const deleteResult = await client.delete(objectName);
    console.log('✅ 模板文件删除成功:', objectName);
    console.log('🔍 删除结果:', deleteResult);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ 模板文件删除失败:', error);
    console.error('🔍 错误详情:', {
      code: error.code,
      message: error.message,
      status: error.status,
      requestId: error.requestId
    });
    
    if (error.code === 'AccessDenied') {
      return { 
        success: false, 
        error: 'AccessDenied', 
        message: '删除权限不足' 
      };
    }
    
    return { 
      success: false, 
      error: error.code || 'UnknownError', 
      message: error.message || '删除失败' 
    };
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