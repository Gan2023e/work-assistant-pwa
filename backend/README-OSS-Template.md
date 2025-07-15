# OSS模板管理功能说明

## 概述

本系统已优化为使用阿里云OSS来存储和管理Excel模板文件，包括：
- **亚马逊发货上传模板**：用于生成亚马逊批量上传文件
- **物流商发票模板**：用于生成物流商发票文件

所有模板文件现在存储在OSS中，提供更好的可靠性、备份和共享能力。

## 功能特性

### ✨ 新功能
- 📁 **OSS文件夹结构**：按类型、国家、物流商自动组织模板文件
- 🔄 **自动备份**：更新或删除模板时自动备份旧版本
- ☁️ **云端存储**：所有模板文件存储在阿里云OSS中
- 🔗 **原始模板下载**：可以下载未填写数据的原始模板文件
- 🛡️ **安全管理**：支持访问控制和权限管理

### 📂 OSS文件夹结构
```
templates/
├── excel/
│   ├── amazon/           # 亚马逊发货模板
│   │   ├── US/          # 美国模板
│   │   ├── UK/          # 英国模板
│   │   ├── DE/          # 德国模板
│   │   └── ...
│   ├── logistics/        # 物流商发票模板
│   │   ├── yushengtai/  # 裕盛泰物流商
│   │   │   ├── US/
│   │   │   ├── UK/
│   │   │   └── ...
│   │   ├── dongfangruida/ # 东方瑞达物流商
│   │   └── others/      # 其他物流商
│   └── packing-list/    # 装箱单模板
├── backup/              # 自动备份文件
│   ├── amazon/
│   └── logistics/
├── config/              # 配置文件
│   ├── amazon-template-config.json
│   └── logistics-invoice-config.json
└── temp/                # 临时文件
```

## 配置步骤

### 1. 配置OSS环境变量

在后端项目根目录创建或编辑 `.env` 文件：

```bash
# OSS配置
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
```

### 2. 运行OSS配置脚本

```bash
# 检查OSS配置
node scripts/checkOSSConfig.js

# 如果没有配置，运行配置向导
node scripts/setupOSS.js

# 创建模板文件夹结构
node scripts/setupOSSTemplates.js
```

### 3. 验证配置

运行检查脚本验证OSS配置是否正确：

```bash
node scripts/checkOSSConfig.js
```

如果看到 `✅ OSS配置完整` 和 `✅ OSS连接测试成功`，说明配置成功。

## 使用方法

### 亚马逊发货模板管理

#### 1. 上传模板
```bash
POST /api/shipping/amazon-template/upload

参数：
- template: Excel文件
- sheetName: Sheet页名称
- merchantSkuColumn: 商家SKU列（如：A）
- quantityColumn: 数量列（如：B）
- startRow: 开始填写行号
- country: 国家代码（如：US, UK, DE）
- countryName: 国家名称（可选）
```

#### 2. 获取配置
```bash
GET /api/shipping/amazon-template/config
GET /api/shipping/amazon-template/config?country=US
```

#### 3. 生成发货文件
```bash
POST /api/shipping/amazon-template/generate
{
  "shippingData": [...],
  "country": "US"
}
```

#### 4. 下载原始模板
```bash
GET /api/shipping/amazon-template/download-original/US
```

#### 5. 删除模板
```bash
DELETE /api/shipping/amazon-template/config?country=US
DELETE /api/shipping/amazon-template/config  # 删除所有
```

### 物流商发票模板管理

#### 1. 上传模板
```bash
POST /api/shipping/logistics-invoice/upload

参数：
- template: Excel文件
- sheetName: Sheet页名称
- logisticsProvider: 物流商名称（如：裕盛泰）
- country: 国家代码（如：US）
- countryName: 国家名称（可选）
```

#### 2. 获取配置
```bash
GET /api/shipping/logistics-invoice/config
GET /api/shipping/logistics-invoice/config?logisticsProvider=裕盛泰&country=US
```

#### 3. 生成发票
```bash
POST /api/shipping/logistics-invoice/generate
{
  "shippingData": [
    {
      "amz_sku": "SKU001",
      "quantity": 10,
      "box_num": "BOX001",
      "logisticsProvider": "裕盛泰",
      "country": "US"
    }
  ]
}
```

#### 4. 下载原始模板
```bash
GET /api/shipping/logistics-invoice/download-original/裕盛泰/US
```

#### 5. 删除模板
```bash
DELETE /api/shipping/logistics-invoice/config?logisticsProvider=裕盛泰&country=US
DELETE /api/shipping/logistics-invoice/config?logisticsProvider=裕盛泰  # 删除物流商所有模板
DELETE /api/shipping/logistics-invoice/config  # 删除所有模板
```

## 前端使用

前端的"发货操作"页面已经更新以支持新的OSS模板管理功能：

1. **管理亚马逊发货上传模板**按钮 - 管理亚马逊模板
2. **管理物流商发票模板**按钮 - 管理物流商发票模板

这些按钮会打开模态框，允许用户：
- 查看现有模板配置
- 上传新模板或更新现有模板
- 删除不需要的模板
- 下载原始模板文件

## 注意事项

### ⚠️ 重要提醒
1. **备份机制**：系统会自动备份被替换或删除的模板文件
2. **权限配置**：确保OSS AccessKey有足够的权限进行读写操作
3. **文件大小**：模板文件大小限制为10MB
4. **支持格式**：支持 .xlsx 和 .xls 格式的Excel文件

### 🔧 故障排除

#### OSS连接失败
```bash
# 检查网络连接
ping oss-cn-hangzhou.aliyuncs.com

# 验证AccessKey权限
node scripts/checkOSSConfig.js
```

#### 模板上传失败
1. 检查文件格式是否为Excel
2. 检查文件大小是否超过10MB
3. 检查OSS存储空间是否足够
4. 检查AccessKey是否有写入权限

#### 生成文件失败
1. 验证模板配置是否存在
2. 检查Sheet页名称是否正确
3. 确认数据格式是否正确

## 迁移说明

如果你之前使用的是本地文件存储的模板，需要：

1. 重新上传所有模板文件到新系统
2. 旧的本地模板文件可以删除
3. 前端无需修改，会自动使用新的API

## 技术支持

如遇到问题，请检查：
1. OSS配置是否正确
2. 网络连接是否正常
3. 服务器日志中的错误信息

更多帮助请参考阿里云OSS官方文档或联系技术支持。 