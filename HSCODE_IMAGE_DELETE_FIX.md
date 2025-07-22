# HSCODE图片删除功能修复说明

## 问题描述
在"HSCODE编码管理"页面中，点击申报图片的删除按钮后，图片从数据库中删除了，但阿里云OSS中的文件没有被成功删除。

## 问题原因
1. **URL格式不匹配**: 数据库中存储的是代理URL格式（如 `/api/hscode/image-proxy?url=xxx`），但删除逻辑只检查了直接的OSS链接格式（包含 `aliyuncs.com`）
2. **objectName提取失败**: 无法从代理URL中正确提取OSS的objectName
3. **错误处理不完善**: 删除失败时没有提供足够的错误信息

## 修复内容

### 1. 后端修复 (`backend/routes/hscode.js`)

**修复前的问题代码:**
```javascript
// 只检查直接的OSS链接
if (/aliyuncs\.com[\/:]/.test(hsCode.declared_image)) {
  // 提取objectName
  const urlObj = new URL(hsCode.declared_image);
  const objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
  ossDeleteResult = await deleteFromOSS(objectName);
}
```

**修复后的代码:**
```javascript
// 支持代理URL和直接OSS链接两种格式
if (hsCode.declared_image && hsCode.declared_image.includes('/api/hscode/image-proxy')) {
  // 从代理URL中提取objectName
  const urlParams = new URLSearchParams(hsCode.declared_image.split('?')[1]);
  objectName = urlParams.get('url');
  if (objectName) {
    objectName = decodeURIComponent(objectName);
  }
} else if (/aliyuncs\.com[\/:]/.test(hsCode.declared_image)) {
  // 直接OSS链接格式
  const urlObj = new URL(hsCode.declared_image);
  objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
}

// 统一处理删除
if (objectName) {
  try {
    ossDeleteResult = await deleteFromOSS(objectName);
    console.log('🗑️ 尝试删除OSS文件:', objectName, '结果:', ossDeleteResult);
  } catch (e) {
    console.warn('OSS图片删除失败:', e.message);
    ossDeleteResult = { success: false, error: e.message };
  }
}
```

### 2. 前端优化 (`frontend/src/pages/Logistics/HsCodeManagement.tsx`)

**增强的错误处理和用户反馈:**
```javascript
// 检查OSS删除结果
if (result.ossDeleteResult) {
  if (result.ossDeleteResult.success) {
    message.success('申报图片删除成功（OSS文件已删除）');
  } else {
    message.warning('申报图片已从数据库删除，但OSS文件删除失败，请联系管理员');
    console.warn('OSS删除失败:', result.ossDeleteResult);
  }
} else {
  message.success('申报图片删除成功');
}
```

**改进的确认对话框:**
```javascript
<Popconfirm
  title="确定要删除这张申报图片吗？"
  description="此操作将同时删除OSS中的文件"
  onConfirm={() => handleDeleteImage(record.parent_sku)}
  okText="确定删除"
  cancelText="取消"
  okType="danger"
>
```

### 3. 调试工具

创建了以下调试脚本：

- `backend/scripts/test-oss-delete.js`: 测试OSS删除功能
- `backend/scripts/debug-hscode-image-delete.js`: 调试HSCODE图片删除问题
- `backend/scripts/check-oss-config.js`: 检查OSS配置

## 使用方法

### 1. 检查OSS配置
```bash
cd backend
node scripts/check-oss-config.js
```

### 2. 调试图片删除问题
```bash
cd backend
node scripts/debug-hscode-image-delete.js
```

### 3. 测试OSS删除功能
```bash
cd backend
node scripts/test-oss-delete.js
```

## 环境变量要求

确保以下环境变量已正确配置：

```env
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=your_endpoint
```

## 权限要求

确保OSS AccessKey具有以下权限：
- `oss:DeleteObject` - 删除对象权限
- `oss:ListObjects` - 列出对象权限（用于调试）

## 测试步骤

1. **上传测试图片**: 在HSCODE管理页面上传一张申报图片
2. **检查数据库**: 确认图片URL已正确存储
3. **删除图片**: 点击删除按钮
4. **验证结果**: 
   - 检查数据库中图片字段是否已清空
   - 检查OSS中文件是否已删除
   - 查看控制台日志确认删除过程

## 故障排除

### 问题1: OSS删除权限不足
**症状**: 删除时提示"AccessDenied"
**解决**: 检查AccessKey权限，确保有删除对象权限

### 问题2: 配置错误
**症状**: 删除时提示"配置不完整"
**解决**: 检查环境变量配置

### 问题3: 网络问题
**症状**: 删除时提示网络错误
**解决**: 检查网络连接和OSS Endpoint配置

## 注意事项

1. **备份重要数据**: 删除操作不可恢复，建议定期备份重要图片
2. **权限最小化**: 只给AccessKey必要的权限
3. **监控日志**: 定期检查删除操作的日志
4. **测试环境**: 建议先在测试环境验证功能

## 更新日志

- **2024-01-03**: 修复代理URL格式的图片删除问题
- **2024-01-03**: 增强错误处理和用户反馈
- **2024-01-03**: 添加调试工具和配置检查脚本 