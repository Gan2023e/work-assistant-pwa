const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class TemplateCache {
  constructor() {
    this.cache = new Map();
    this.cacheDir = path.join(__dirname, '../cache/templates');
    this.ensureCacheDir();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log('📁 创建模板缓存目录:', this.cacheDir);
    }
  }

  getCacheKey(country, templateName) {
    return `${country}_${templateName}`;
  }

  getCachePath(cacheKey) {
    return path.join(this.cacheDir, `${cacheKey}.cache`);
  }

  getMetaPath(cacheKey) {
    return path.join(this.cacheDir, `${cacheKey}.meta.json`);
  }

  // 检查缓存是否存在且有效
  async isCacheValid(cacheKey, remoteLastModified = null) {
    const cachePath = this.getCachePath(cacheKey);
    const metaPath = this.getMetaPath(cacheKey);
    
    if (!fs.existsSync(cachePath) || !fs.existsSync(metaPath)) {
      return false;
    }

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      
      // 检查缓存是否过期（24小时）
      const cacheAge = Date.now() - meta.cacheTime;
      if (cacheAge > 24 * 60 * 60 * 1000) {
        console.log('⏰ 模板缓存已过期（超过24小时）');
        return false;
      }

      // 如果有远程修改时间，比较是否需要更新
      if (remoteLastModified && meta.lastModified) {
        if (new Date(remoteLastModified) > new Date(meta.lastModified)) {
          console.log('🔄 远程模板已更新，缓存失效');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ 检查缓存有效性失败:', error);
      return false;
    }
  }

  // 从缓存获取模板
  async getFromCache(cacheKey) {
    try {
      const cachePath = this.getCachePath(cacheKey);
      const metaPath = this.getMetaPath(cacheKey);
      
      if (!fs.existsSync(cachePath)) {
        return null;
      }

      const cacheData = fs.readFileSync(cachePath);
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      
      console.log(`📦 从缓存加载模板: ${cacheKey} (${(cacheData.length / 1024).toFixed(1)}KB)`);
      
      // 返回缓存的模板信息
      return {
        content: cacheData,
        fileName: meta.fileName,
        originalExtension: meta.originalExtension,
        size: cacheData.length,
        fromCache: true
      };
    } catch (error) {
      console.error('❌ 从缓存读取失败:', error);
      return null;
    }
  }

  // 保存到缓存
  async saveToCache(cacheKey, templateData, templateMeta) {
    try {
      const cachePath = this.getCachePath(cacheKey);
      const metaPath = this.getMetaPath(cacheKey);
      
      // 保存模板文件内容
      fs.writeFileSync(cachePath, templateData.content);
      
      // 保存元数据
      const meta = {
        fileName: templateMeta.fileName,
        originalExtension: templateMeta.originalExtension,
        lastModified: templateMeta.lastModified,
        cacheTime: Date.now(),
        size: templateData.content.length
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      
      console.log(`💾 模板已缓存: ${cacheKey} (${(templateData.content.length / 1024).toFixed(1)}KB)`);
      return true;
    } catch (error) {
      console.error('❌ 保存到缓存失败:', error);
      return false;
    }
  }

  // 获取模板（优先从缓存，必要时从OSS下载）
  async getTemplate(country = 'UK') {
    const { listTemplateFiles, downloadTemplateFromOSS } = require('./oss');
    
    try {
      console.log(`🔍 获取${country}模板，优先使用缓存...`);
      
      // 1. 快速获取模板列表（这个操作相对较快）
      const templateResult = await listTemplateFiles('amazon', null, country);
      
      if (!templateResult.success || !templateResult.files || templateResult.files.length === 0) {
        throw new Error(`未找到${country}资料模板，请先上传模板`);
      }

      const templateFile = templateResult.files[0];
      const cacheKey = this.getCacheKey(country, templateFile.name);
      
      // 2. 检查缓存是否有效
      const isValid = await this.isCacheValid(cacheKey, templateFile.lastModified);
      
      if (isValid) {
        // 从缓存加载（超快速！）
        const cachedTemplate = await this.getFromCache(cacheKey);
        if (cachedTemplate) {
          return cachedTemplate;
        }
      }

      // 3. 缓存无效或不存在，从OSS下载
      console.log(`📥 从OSS下载${country}模板文件...`);
      const downloadResult = await downloadTemplateFromOSS(templateFile.name);
      
      if (!downloadResult.success) {
        throw new Error(`下载模板失败: ${downloadResult.message}`);
      }

      // 4. 检测文件格式
      let originalExtension = 'xlsm';
      const fileName = templateFile.fileName || templateFile.name || '';
      if (fileName && typeof fileName === 'string') {
        const parts = fileName.split('.');
        if (parts.length > 1) {
          originalExtension = parts.pop().toLowerCase();
        }
      }

      // 5. 保存到缓存
      const templateMeta = {
        fileName: fileName,
        originalExtension: originalExtension,
        lastModified: templateFile.lastModified
      };
      
      await this.saveToCache(cacheKey, downloadResult, templateMeta);

      // 6. 返回模板数据
      return {
        content: downloadResult.content,
        fileName: fileName,
        originalExtension: originalExtension,
        size: downloadResult.size,
        fromCache: false
      };

    } catch (error) {
      console.error(`❌ 获取${country}模板失败:`, error);
      throw error;
    }
  }

  // 清除缓存
  clearCache(country = null) {
    try {
      if (country) {
        // 清除特定国家的缓存
        const files = fs.readdirSync(this.cacheDir);
        const targetPrefix = `${country}_`;
        
        files.forEach(file => {
          if (file.startsWith(targetPrefix)) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        });
        console.log(`🗑️ 已清除${country}模板缓存`);
      } else {
        // 清除所有缓存
        if (fs.existsSync(this.cacheDir)) {
          fs.rmSync(this.cacheDir, { recursive: true, force: true });
          this.ensureCacheDir();
        }
        console.log('🗑️ 已清除所有模板缓存');
      }
    } catch (error) {
      console.error('❌ 清除缓存失败:', error);
    }
  }

  // 获取缓存统计信息
  getCacheStats() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return { totalFiles: 0, totalSize: 0 };
      }

      const files = fs.readdirSync(this.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.cache'));
      
      let totalSize = 0;
      cacheFiles.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });

      return {
        totalFiles: cacheFiles.length,
        totalSize: totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(1)
      };
    } catch (error) {
      console.error('❌ 获取缓存统计失败:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }
}

// 创建全局实例
const templateCache = new TemplateCache();

module.exports = templateCache; 