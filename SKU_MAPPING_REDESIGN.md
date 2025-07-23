# 发货管理页面 SKU 映射方法重新设计

## 概述

根据用户需求，重新设计了发货管理页面中本地SKU和Amazon SKU的对映方法，实现了基于 `listings_sku` 表的新映射逻辑。

## 新映射方法流程

### 1. 数据源准备
- **listings_sku 表**: 包含 seller-sku、site、fulfillment-channel 字段
- **pbi_amzsku_sku 表**: 包含 amz_sku、site、country、local_sku 字段  
- **local_boxes 表**: 包含 sku、country 字段

### 2. 映射逻辑步骤

#### 步骤1: 获取Amazon FBA数据
```sql
SELECT DISTINCT seller_sku, site, fulfillment_channel
FROM listings_sku 
WHERE fulfillment_channel LIKE '%AMAZON%'
```

#### 步骤2: 建立关联表
- 通过 `listings_sku.seller_sku` = `pbi_amzsku_sku.amz_sku` 关联
- 通过 `listings_sku.site` = `pbi_amzsku_sku.site` 关联
- 建立包含以下字段的关联数据：
  - amazon_seller_sku (来自 listings_sku.seller_sku)
  - site 
  - fulfillment_channel
  - country
  - local_sku

#### 步骤3: 最终SKU映射
- 使用 `local_boxes.sku` = `关联表.local_sku` 关联
- 使用 `local_boxes.country` = `关联表.country` 关联  
- 查询结果中的 `amazon_seller_sku` 就是最终的 Amazon SKU

## 实现的功能

### 后端实现

1. **重新设计的API**: `/api/shipping/merged-data`
   - 使用新的映射逻辑
   - 支持Amazon FBA履行渠道识别
   - 提供映射统计信息

2. **调试端点**: `/api/shipping/debug-new-mapping`
   - 检查 listings_sku 表是否存在
   - 测试关联逻辑
   - 提供诊断信息和建议

### 前端实现

1. **数据接口更新**
   - 新增 `amazon_sku` 字段显示
   - 新增 `site` 字段显示Amazon站点
   - 新增 `fulfillment_channel` 字段显示履行渠道
   - 新增 `mapping_method` 标记使用的映射方法

2. **界面优化**
   - Amazon SKU 列显示新旧映射对比
   - 新增站点/渠道列显示FBA标识
   - 使用颜色标签区分映射方法

## 数据表字段要求

### listings_sku 表
- `seller_sku`: 卖家SKU (对应Amazon SKU)
- `site`: 站点信息 (如 US、UK、DE等)
- `fulfillment_channel`: 履行渠道 (需包含 "AMAZON" 标识FBA)

### pbi_amzsku_sku 表  
- `amz_sku`: Amazon SKU (与 listings_sku.seller_sku 关联)
- `site`: 站点信息 (与 listings_sku.site 关联)
- `country`: 国家信息
- `local_sku`: 本地SKU
- `update_time`: 更新时间

### local_boxes 表
- `sku`: 本地SKU (与 pbi_amzsku_sku.local_sku 关联)
- `country`: 国家信息 (与 pbi_amzsku_sku.country 关联)
- `total_quantity`: 库存数量

## 使用方法

### 1. 数据准备
确保以下数据表已准备好：
- `listings_sku` 表包含Amazon FBA产品数据
- `pbi_amzsku_sku` 表包含SKU映射关系
- `local_boxes` 表包含库存数据

### 2. 测试新映射逻辑
访问调试端点检查数据准备情况：
```
GET /api/shipping/debug-new-mapping
```

### 3. 使用新映射
发货管理页面会自动使用新的映射逻辑，显示：
- 新的Amazon SKU映射结果
- Amazon站点信息
- FBA履行渠道标识
- 映射方法标记

## 优势与特性

### 1. 更准确的映射
- 基于实际Amazon listings数据
- 支持多站点区分
- 考虑履行渠道差异

### 2. 更丰富的信息
- 显示Amazon站点
- 标识FBA履行渠道
- 提供映射来源追踪

### 3. 更好的可维护性
- 清晰的数据流程
- 完整的调试工具
- 详细的错误诊断

### 4. 向后兼容
- 保留原有字段 `amz_sku`
- 新增字段 `amazon_sku` 
- 标记映射方法来源

## 注意事项

1. **数据表依赖**: 需要确保 `listings_sku` 表存在且有相应权限
2. **数据质量**: 映射效果取决于各表之间数据的完整性和准确性
3. **性能考虑**: 大数据量情况下可能需要添加适当的数据库索引
4. **测试建议**: 使用调试端点验证映射逻辑是否正常工作

## 故障排除

如果映射不正常，请检查：
1. `listings_sku` 表是否存在且有数据
2. `fulfillment_channel` 字段是否包含 "AMAZON"
3. `pbi_amzsku_sku` 表的关联数据是否完整
4. 站点字段 `site` 是否匹配
5. 使用调试端点获取详细诊断信息 