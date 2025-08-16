# 整箱数量列箱数信息显示问题修复总结

## 🔍 问题描述

在发货操作页面的整箱数量列中，有整箱数量的记录并没有显示箱数信息，显示为0箱或空值。

## 🔧 根本原因分析

问题出现在后端API的箱数计算逻辑中。对于部分出库的整箱库存，系统直接使用了`total_boxes`字段，而没有按比例计算剩余的箱数。

### 具体问题：
1. **orderManagement.js**: 在计算`whole_box_count`时，直接使用了`boxes`（即`total_boxes`）
2. **shipping.js**: 多个SQL查询中直接使用`total_boxes`而没有考虑部分出库情况
3. **inventoryUtils.js**: 同样存在直接使用`total_boxes`的问题

## 🛠️ 修复内容

### 1. 修复 `backend/routes/orderManagement.js`

**修复前：**
```javascript
wholeBoxCount += boxes; // 直接使用total_boxes
```

**修复后：**
```javascript
// 计算剩余箱数：按比例计算
if (totalQuantity > 0 && totalBoxes > 0) {
  const remainingBoxes = Math.ceil((availableQuantity / totalQuantity) * totalBoxes);
  wholeBoxCount += remainingBoxes;
}
```

### 2. 修复 `backend/routes/shipping.js`

修复了多个SQL查询中的箱数计算逻辑：

**修复前：**
```sql
SUM(CASE WHEN lb.box_type = '整箱' THEN lb.total_boxes ELSE 0 END) as whole_box_count
```

**修复后：**
```sql
-- 计算整箱的可用箱数：按比例计算剩余箱数
SUM(CASE 
  WHEN lb.box_type = '整箱' AND lb.total_quantity > 0 
  THEN CEIL((lb.total_quantity - COALESCE(lb.shipped_quantity, 0)) * lb.total_boxes / lb.total_quantity)
  ELSE 0 
END) as whole_box_count
```

### 3. 修复 `backend/utils/inventoryUtils.js`

**修复前：**
```javascript
LocalBox.sequelize.literal("CASE WHEN box_type = '整箱' THEN total_boxes ELSE 0 END")
```

**修复后：**
```javascript
LocalBox.sequelize.literal("CASE WHEN box_type = '整箱' AND total_quantity > 0 THEN CEIL((total_quantity - COALESCE(shipped_quantity, 0)) * total_boxes / total_quantity) ELSE 0 END")
```

## 📊 修复逻辑说明

### 箱数计算公式：
```
剩余箱数 = CEIL((剩余数量 / 总数量) * 总箱数)
```

### 示例：
- 总数量：100件
- 总箱数：5箱
- 已出库：30件
- 剩余数量：70件
- **修复前**：显示5箱（错误）
- **修复后**：显示4箱（CEIL(70/100 * 5) = CEIL(3.5) = 4箱）

## 🎯 预期效果

1. **准确显示箱数**：整箱数量列将正确显示剩余的箱数信息
2. **部分出库处理**：对于部分出库的记录，按比例计算剩余箱数
3. **数据一致性**：前端显示的箱数与实际库存状态保持一致

## 📋 验证步骤

1. 重启后端服务
2. 访问发货操作页面
3. 查看有整箱数量的记录
4. 验证：
   - 整箱数量列是否显示正确的箱数信息
   - 部分出库记录的箱数是否按比例计算
   - 箱数信息是否不再显示为0或空值

## 🔧 相关文件

- `backend/routes/orderManagement.js` - 需求单详情API
- `backend/routes/shipping.js` - 发货相关API（多个查询）
- `backend/utils/inventoryUtils.js` - 库存工具函数
- `frontend/src/pages/Shipping/OrderManagementPage.tsx` - 前端显示组件

## 📝 注意事项

- 使用`CEIL`函数向上取整，确保不会出现小数箱数
- 只有当`total_quantity > 0`时才进行计算，避免除零错误
- 使用`COALESCE(shipped_quantity, 0)`处理空值情况 