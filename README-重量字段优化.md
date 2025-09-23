# 采购链接管理 - 重量字段优化说明

## 📋 优化概述
本次优化在"采购链接管理"功能中的"子SKU明细"表格中添加了重量相关字段，便于管理产品重量信息。

## ✨ 新增功能
### 1. 子SKU明细表格新增列
- **重量(kg)**：数字输入框，支持小数点后3位，范围0-50
- **重量类型**：下拉选择框，选项为"预估"或"实测"，默认为"预估"

### 2. SKU详情显示
在SKU详情弹窗中新增重量信息显示，包含：
- 重量数值（单位：千克）
- 重量类型标签（实测-绿色，预估-橙色）

## 🗄️ 数据库变更
需要在 `sellerinventory_sku` 表中添加以下字段：

```sql
-- 1. 添加重量字段
ALTER TABLE sellerinventory_sku 
ADD COLUMN weight DECIMAL(8, 3) NULL 
COMMENT '产品重量(千克)';

-- 2. 添加重量类型字段
ALTER TABLE sellerinventory_sku 
ADD COLUMN weight_type ENUM('estimated', 'measured') NULL DEFAULT 'estimated' 
COMMENT '重量类型：estimated-预估, measured-实测';
```

## 📁 修改文件列表
### 前端文件
- `frontend/src/pages/Products/PurchaseLink.tsx`
- `frontend/src/pages/Products/Listings.tsx` 
- `frontend/src/pages/Products/Listings_backup.tsx`

### 后端文件  
- `backend/models/SellerInventorySku.js`
- `backend/routes/productWeblink.js`
- `backend/migrations/20250923-add-weight-fields-to-sellerinventory-sku.js`

## 🚀 部署步骤
1. **执行数据库脚本**：运行 `数据库字段添加.sql` 文件中的SQL语句
2. **更新代码**：拉取最新的代码变更
3. **重启服务**：重启后端Node.js服务
4. **验证功能**：访问采购链接管理页面，确认重量字段正常显示和保存

## 💡 使用说明
1. 在采购链接管理页面，当出现"子SKU明细"表格时，可以填写产品重量
2. 重量单位为千克，可以填写小数（如：0.125）
3. 重量类型可选择"预估"或"实测"，默认为"预估"
4. 提交后，重量信息会自动保存到数据库
5. 在SKU详情弹窗中可以查看保存的重量信息

## 📦 数据转换
如果之前已有克单位的重量数据，请执行 `数据转换-克转千克.sql` 文件中的SQL语句进行数据转换。 