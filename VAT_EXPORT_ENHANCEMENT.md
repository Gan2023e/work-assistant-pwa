# VAT税单导出功能增强

## 功能概述

根据用户需求，我们增强了VAT税单导出功能，现在不仅生成Excel文件，还会创建一个包含所有相关文件的ZIP压缩包。

## 主要改进

### 1. 从单一Excel文件升级为ZIP压缩包

**之前：**
- 只生成Excel文件
- 文件名：`英国VAT税单_YYYY年第一季度.xlsx`

**现在：**
- 创建ZIP压缩包
- 文件名：`英国VAT税单_YYYY年第一季度.zip`
- 包含Excel文件和所有相关的PDF文件

### 2. 文件夹结构

```
英国VAT税单_YYYY年第一季度/
├── VAT税单列表.xlsx          # Excel数据文件
└── PDF文件/                  # PDF文件目录
    ├── 税单1.pdf
    ├── 税单2.pdf
    └── ...
```

### 3. 技术实现

#### 后端技术栈
- **Node.js + Express**：API服务
- **Sequelize ORM**：数据库查询
- **xlsx**：生成Excel文件
- **archiver**：创建ZIP压缩包
- **ali-oss**：从OSS获取PDF文件

#### 核心功能
1. **数据库查询**：根据时间范围和目的地国家查询VAT税单记录
2. **Excel生成**：创建包含完整信息的Excel文件
3. **OSS文件获取**：从阿里云OSS获取相关的PDF文件
4. **ZIP打包**：将所有文件打包成ZIP压缩包
5. **流式下载**：使用流式传输，支持大文件下载

### 4. 错误处理

- **OSS配置缺失**：如果OSS配置不完整，仍会创建ZIP包但不包含PDF文件
- **PDF文件缺失**：如果某个PDF文件获取失败，会继续处理其他文件
- **网络错误**：提供详细的错误信息和重试机制

### 5. 性能优化

- **压缩级别**：使用最高压缩级别（level 9）减小文件大小
- **流式处理**：避免内存溢出，支持大量文件处理
- **并发处理**：异步处理PDF文件获取，提高效率

## 使用流程

### 用户操作
1. 进入"头程物流管理"页面
2. 点击"导出上季VAT税单"按钮
3. 系统自动计算上季度时间范围
4. 等待下载完成（包含进度提示）

### 系统处理
1. **查询数据**：从数据库查询符合条件的VAT税单记录
2. **生成Excel**：创建包含完整信息的Excel文件
3. **获取PDF**：从OSS获取所有相关的PDF文件
4. **创建ZIP**：将所有文件打包成ZIP压缩包
5. **下载文件**：将ZIP文件发送给用户

## 季度计算逻辑

| 当前月份 | 导出季度 | 时间范围 |
|---------|---------|---------|
| 4-6月   | 第一季度 | 1-3月   |
| 7-9月   | 第二季度 | 4-6月   |
| 10-12月 | 第三季度 | 7-9月   |
| 1-3月   | 第四季度 | 上一年10-12月 |

## 文件命名规则

### ZIP文件
- 格式：`英国VAT税单_YYYY年第一季度.zip`
- 示例：`英国VAT税单_2024年第一季度.zip`

### Excel文件
- 格式：`VAT税单列表.xlsx`
- 位置：ZIP包根目录

### PDF文件
- 格式：使用原始文件名或生成安全文件名
- 位置：ZIP包内的`PDF文件/`目录
- 安全文件名格式：`{ShippingID}_VAT税单.pdf`

## 数据字段

### Excel文件包含字段
1. 序号
2. Shipping ID
3. 物流商
4. 渠道
5. 跟踪号
6. 箱数
7. 产品数
8. 发出日期
9. 开航日
10. 预计到港日
11. 预计到仓日
12. 目的地仓库
13. 运费
14. 计费重量
15. MRN
16. 关税
17. VAT税额
18. VAT税单日期
19. VAT税单文件名
20. VAT税单上传时间

## 部署要求

### 后端依赖
```bash
npm install archiver
```

### 环境变量
确保以下OSS配置正确：
- `OSS_REGION`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `OSS_BUCKET`
- `OSS_ENDPOINT`

### 数据库
确保Logistics表包含以下字段：
- `vatReceiptObjectName`：OSS对象名
- `vatReceiptFileName`：原始文件名
- `vatReceiptTaxDate`：税单日期

## 注意事项

1. **文件大小**：ZIP包可能较大，下载时间较长
2. **网络稳定性**：需要稳定的网络连接获取PDF文件
3. **OSS权限**：确保OSS配置正确且有读取权限
4. **存储空间**：确保服务器有足够空间处理临时文件
5. **并发限制**：避免同时进行多个导出操作

## 故障排除

### 常见问题
1. **ZIP包为空**：检查OSS配置和网络连接
2. **PDF文件缺失**：检查OSS文件是否存在
3. **下载失败**：检查网络连接和服务器状态
4. **文件损坏**：重新下载或检查网络稳定性

### 日志查看
后端会输出详细的处理日志，包括：
- 查询结果数量
- PDF文件获取状态
- 错误信息和处理进度

## 未来优化

1. **进度显示**：在前端显示下载进度
2. **断点续传**：支持大文件断点续传
3. **缓存机制**：缓存已下载的PDF文件
4. **压缩优化**：根据文件类型选择最佳压缩方式
5. **并发控制**：限制同时进行的导出操作数量 