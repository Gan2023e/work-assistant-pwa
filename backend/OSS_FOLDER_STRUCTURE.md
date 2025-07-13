# OSS发票文件夹结构说明

## 📁 文件夹结构

您的OSS存储桶中已经创建了以下专用发票文件夹结构：

```
invoices/
├── purchase/               # 采购发票
│   └── 2025/              # 按年份分类
│       └── 07/            # 按月份分类
├── sales/                 # 销售发票
│   └── 2025/              # 按年份分类
├── temp/                  # 临时文件
├── archive/               # 归档文件
│   └── 2025/              # 按年份分类
└── 2025/                  # 通用年份文件夹
    ├── 07/                # 当前月份
    └── 08/                # 下个月份
```

## 🎯 使用方法

### 1. 上传文件到不同文件夹

在调用 `uploadToOSS` 函数时，可以指定不同的文件夹类型：

```javascript
// 上传采购发票（默认）
const result = await uploadToOSS(buffer, filename, 'purchase');
// 文件路径：invoices/purchase/2025/07/uuid.pdf

// 上传销售发票
const result = await uploadToOSS(buffer, filename, 'sales');
// 文件路径：invoices/sales/2025/07/uuid.pdf

// 上传临时文件
const result = await uploadToOSS(buffer, filename, 'temp');
// 文件路径：invoices/temp/uuid.pdf

// 上传归档文件
const result = await uploadToOSS(buffer, filename, 'archive');
// 文件路径：invoices/archive/2025/uuid.pdf
```

### 2. 自动路径生成规则

- **采购发票**: `invoices/purchase/年份/月份/文件名`
- **销售发票**: `invoices/sales/年份/月份/文件名`
- **临时文件**: `invoices/temp/文件名`
- **归档文件**: `invoices/archive/年份/文件名`

### 3. 文件类型支持

系统自动识别以下文件类型：
- `.pdf` → `application/pdf`
- `.jpg/.jpeg` → `image/jpeg`
- `.png` → `image/png`
- 其他 → `application/octet-stream`

## 🔧 API 接口使用

### 采购发票管理系统

当前采购发票管理系统默认使用 `purchase` 文件夹：

```javascript
// 在 routes/purchaseInvoice.js 中
const uploadResult = await uploadToOSS(
  req.file.buffer,
  req.file.originalname,
  'purchase'  // 使用采购发票文件夹
);
```

### 扩展其他系统

如果要为其他系统添加文件上传功能，可以这样使用：

```javascript
// 销售发票系统
const salesResult = await uploadToOSS(buffer, filename, 'sales');

// 临时文件处理
const tempResult = await uploadToOSS(buffer, filename, 'temp');

// 归档文件处理
const archiveResult = await uploadToOSS(buffer, filename, 'archive');
```

## 📊 文件夹管理

### 查看文件夹结构

```bash
# 运行文件夹设置脚本
cd backend
node scripts/setupOSSFolders.js
```

## 🗂️ 文件命名规则

- **唯一性**: 使用 UUID 确保文件名唯一
- **扩展名**: 保持原文件扩展名
- **路径**: 按类型和时间自动分类

示例文件路径：
```
invoices/purchase/2025/07/a1b2c3d4-e5f6-7890-1234-567890abcdef.pdf
invoices/sales/2025/07/f9e8d7c6-b5a4-3210-9876-543210fedcba.pdf
invoices/temp/temp-file-uuid.pdf
invoices/archive/2025/archive-file-uuid.pdf
```

## 🔒 访问控制

- 所有文件均存储在专用的 `invoices/` 目录下
- 支持删除操作（需要配置相应权限）
- 支持生成签名URL用于安全访问

## 📈 监控和维护

### 文件统计
- 按文件夹类型统计文件数量
- 按时间段统计存储使用量
- 定期清理测试文件

### 最佳实践
1. 使用合适的文件夹类型
2. 定期归档旧文件
3. 清理不必要的临时文件
4. 监控存储使用量

## 🚀 未来扩展

### 可扩展的文件夹类型
- `contracts/` - 合同文件
- `reports/` - 报告文件
- `backup/` - 备份文件

### 高级功能
- 文件版本控制
- 批量文件操作
- 文件搜索和过滤
- 自动归档策略

---

**注意**: 这个文件夹结构是专为发票管理系统设计的，确保了文件的有序存储和高效管理。 