# Listings页面Tab功能说明

## 🎯 功能概述

现在"在线Listings管理"页面已成功添加了Tab功能，包含两个页面：

### 📋 Tab 1: SKU映射管理
- **原有功能**: 基于`seller_inventory_sku`表的SKU映射管理
- **主要特性**: 母SKU/子SKU管理、上架状态、映射关系等
- **数据视角**: 从本地库存SKU角度查看Amazon映射

### 🚀 Tab 2: Listings SKU数据 (新增)
- **新增功能**: 基于`listings_sku`表的Amazon Listing数据管理
- **主要特性**: 
  - 真实Amazon Listing数据展示
  - 价格、库存数量、ASIN信息
  - 履行渠道筛选 (FBA/FBM)
  - 站点、国家多维度筛选
  - 完整的数据关联查询

## 🔧 技术实现

### 文件结构
```
frontend/src/pages/Products/
├── Listings.tsx              # 原有SKU映射页面
├── ListingsSku.tsx          # 新增Listings SKU页面  
├── ListingsWithTabs.tsx     # 集成Tab功能的主页面
└── README_Listings_Tab.md   # 说明文档
```

### API接口
- **SKU映射**: `/api/listings` (原有)
- **Listings SKU**: `/api/listings/sku-data` (新增)

### 数据表关联
```sql
-- 新页面的数据关联逻辑
listings_sku (主表)
  ↓ LEFT JOIN (seller-sku = amz_sku, site = site)
pbi_amzsku_sku (映射表)  
  ↓ LEFT JOIN (local_sku = child_sku)
seller_inventory_sku (库存表)
  ↓ LEFT JOIN (parent_sku = parent_sku)  
product_weblink (产品表)
```

## 🎨 用户界面

访问 `/products/listings` 路径将看到：

1. **Tab导航栏**: 
   - "SKU映射管理" (原有功能)
   - "Listings SKU数据" (新增功能)

2. **新Tab功能**:
   - 🔍 多维度筛选 (站点/履行渠道/状态/国家)
   - 📊 统计面板 (总数/活跃/FBA/FBM分布)
   - 📋 详细数据表格
   - 📤 CSV数据导出

## ✅ 使用方法

1. 进入"在线Listings管理"页面
2. 点击"Listings SKU数据"标签页
3. 使用筛选条件查找所需数据
4. 查看统计信息和详细列表
5. 可导出CSV文件用于进一步分析

## 💡 优势对比

| 功能对比 | SKU映射管理 | Listings SKU数据 |
|---------|------------|-----------------|
| 数据源 | 本地库存表 | Amazon实时数据 |
| 视角 | 本地→Amazon | Amazon→本地 |
| 信息完整性 | 基础映射信息 | 完整商业数据 |
| 筛选维度 | 基础筛选 | 多维度筛选 |
| 业务用途 | 映射管理 | 业务分析 |

现在你可以从两个不同的角度管理和分析Listings数据了！ 