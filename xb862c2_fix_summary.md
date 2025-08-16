# XB862C2库存计算问题修复总结

## 🔍 问题分析

### 问题描述
XB862C2这个SKU凭空出现了22个混合箱库存，显示为"库存未映射"状态。

### 根本原因
1. **SQL查询逻辑错误**: `backend/routes/shipping.js` 中的多个SQL查询仍然使用旧的 `mix_box_num` 字段来区分整箱和混合箱
2. **库存计算错误**: 没有计算剩余可用数量（`total_quantity - shipped_quantity`）
3. **状态筛选不完整**: 只筛选'待出库'状态，没有包含'部分出库'状态

## 🛠️ 修复内容

### 1. 修复主查询SQL（第1048-1074行）
```sql
-- 修正前：
SUM(CASE WHEN lb.mix_box_num IS NULL OR lb.mix_box_num = '' THEN lb.total_quantity ELSE 0 END) as whole_box_quantity

-- 修正后：
SUM(CASE WHEN lb.box_type = '整箱' THEN (lb.total_quantity - COALESCE(lb.shipped_quantity, 0)) ELSE 0 END) as whole_box_quantity
```

### 2. 修复未映射库存查询SQL（第1413-1428行）
```sql
-- 修正前：
AND lb.status = '待出库'

-- 修正后：
AND lb.status IN ('待出库', '部分出库')
```

### 3. 修复测试查询（第1805-1824行）
统一使用 `box_type` 字段和剩余可用数量计算。

## 🎯 预期效果

1. **正确的库存分类**: 使用 `box_type` 字段准确区分整箱和混合箱
2. **准确的库存数量**: 计算真实的剩余可用数量（扣除已出库）
3. **完整的状态筛选**: 包含所有可发货状态的库存
4. **消除虚假"库存未映射"**: XB862C2如果有正确映射关系，不应显示为未映射

## 📋 验证步骤

1. 重启后端服务
2. 访问发货操作页面
3. 搜索 XB862C2
4. 验证：
   - 是否还显示为"库存未映射"
   - 库存数量是否正确（扣除已出库）
   - 整箱/混合箱分类是否正确

## 🔧 相关文件

- `backend/routes/shipping.js` - 主要修复文件
- `backend/routes/orderManagement.js` - 之前已修复
- `frontend/src/pages/Shipping/OrderManagementPage.tsx` - 前端显示优化

修复确保了前后端计算逻辑的一致性，应该能解决XB862C2凭空出现22个混合箱库存的问题。
