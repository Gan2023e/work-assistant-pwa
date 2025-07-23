# HSCODE删除时OSS图片删除功能修复

## 问题描述
在"HSCODE编码管理"页面中，点击"操作"列中的删除按钮后，只会删除数据库中的HSCODE记录，但不会删除阿里云OSS中对应的申报图片文件，导致OSS中残留未使用的图片文件。

## 修复内容

### 1. 后端修复 (`backend/routes/hscode.js`)

#### 新增辅助函数
```javascript
// 辅助函数：从申报图片URL中提取OSS objectName
const extractOSSObjectName = (declaredImage) => {
  if (!declaredImage) return null;
  
  let objectName = null;
  
  // 检查是否为代理URL格式
  if (declaredImage.includes('/api/hscode/image-proxy')) {
    try {
      // 从代理URL中提取objectName
      const urlParams = new URLSearchParams(declaredImage.split('?')[1]);
      objectName = urlParams.get('url');
      if (objectName) {
        objectName = decodeURIComponent(objectName);
      }
    } catch (e) {
      console.warn('解析代理URL失败:', e.message);
    }
  } else if (/aliyuncs\.com[\/:]/.test(declaredImage)) {
    // 直接OSS链接格式
    try {
      const urlObj = new URL(declaredImage);
      objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    } catch (e) {
      console.warn('解析OSS URL失败:', e.message);
    }
  }
  
  return objectName;
};
```

#### 修改删除HSCODE记录逻辑
在删除HSCODE记录的路由中，添加了OSS图片删除逻辑：

1. **在删除数据库记录之前**，先检查是否有申报图片
2. **提取OSS objectName**，支持代理URL和直接OSS链接两种格式
3. **删除OSS文件**，如果提取成功则调用`deleteFromOSS()`
4. **删除本地文件**，如果OSS删除失败则删除本地文件
5. **返回详细结果**，包含OSS删除状态信息

#### 优化删除申报图片逻辑
重构了删除申报图片的路由，使用新的辅助函数，避免代码重复。

### 2. 支持的URL格式

#### 代理URL格式
```
/api/hscode/image-proxy?url=hscode-images%2Ftest_sku_123.jpg
```

#### 直接OSS链接格式
```
https://your-bucket.oss-cn-hangzhou.aliyuncs.com/hscode-images/test_sku_456.jpg
```

### 3. 错误处理

- **OSS删除失败**：记录删除成功，但OSS文件删除失败，返回警告信息
- **URL解析失败**：尝试删除本地文件作为备选方案
- **网络异常**：提供详细的错误日志和用户友好的错误信息

### 4. 测试验证

创建了测试脚本 `backend/scripts/test-hscode-delete-with-oss.js` 来验证：
- 代理URL格式解析
- 直接OSS链接格式解析
- 空值处理
- 无效URL处理

## 修复效果

### 修复前
- 删除HSCODE记录时只删除数据库记录
- OSS中残留未使用的图片文件
- 浪费存储空间

### 修复后
- 删除HSCODE记录时同时删除OSS图片文件
- 自动清理未使用的图片文件
- 节省存储空间
- 提供详细的删除状态反馈

## 使用说明

1. **删除HSCODE记录**：点击"操作"列中的删除按钮
   - 会同时删除数据库记录和OSS图片文件
   - 返回删除状态信息

2. **删除申报图片**：点击图片上的删除按钮
   - 只删除图片文件，保留HSCODE记录
   - 同样支持OSS和本地文件删除

## 注意事项

- 删除操作不可恢复，请谨慎操作
- 如果OSS删除失败，会记录错误日志但不会影响数据库记录的删除
- 建议定期检查OSS存储使用情况，确保清理效果 