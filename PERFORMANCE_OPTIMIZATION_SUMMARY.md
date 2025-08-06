# 需求单性能优化总结

## 优化背景
用户反馈新建需求单时"点击后花费较长时间录入"，经过分析发现主要性能瓶颈在SKU冲突检查和需求单详情查询环节。

## 性能问题分析

### 问题1：SKU冲突检查性能瓶颈
**位置**: `backend/routes/orderManagement.js` - `/check-conflicts` 接口
**原因**: 循环查询每个需求单记录的已发货数量
```javascript
// 原有问题代码
for (const need of existingNeeds) {
  const shippedQuantity = await ShipmentItem.sum('shipped_quantity', {
    where: { order_item_id: need.record_num }
  }) || 0;
}
```

### 问题2：需求单详情查询性能瓶颈
**位置**: `backend/routes/orderManagement.js` - `/orders/:needNum/details` 接口
**原因**: 在Promise.all中对每个item单独查询已发货数量
```javascript
// 原有问题代码
const shipped = await ShipmentItem.sum('shipped_quantity', {
  where: { order_item_id: item.record_num }
}) || 0;
```

## 优化方案

### 优化1：批量查询SKU冲突检查
将N次单独查询优化为1次批量查询：
```javascript
// 批量查询所有相关记录的已发货数量
const shippedQuantities = await ShipmentItem.findAll({
  where: { order_item_id: { [Op.in]: recordNums } },
  attributes: [
    'order_item_id',
    [sequelize.fn('SUM', sequelize.col('shipped_quantity')), 'total_shipped']
  ],
  group: ['order_item_id'],
  raw: true
});

// 构建映射关系，避免循环查询
const shippedMap = shippedQuantities.reduce((map, item) => {
  map[item.order_item_id] = parseInt(item.total_shipped) || 0;
  return map;
}, {});
```

### 优化2：批量查询需求单详情
同样优化需求单详情查询中的已发货数量获取：
```javascript
// 批量查询已发货数量
const orderRecordNums = orderItems.map(item => item.record_num);
const shippedQuantities = await ShipmentItem.findAll({
  where: { order_item_id: { [Op.in]: orderRecordNums } },
  attributes: [
    'order_item_id',
    [sequelize.fn('SUM', sequelize.col('shipped_quantity')), 'total_shipped']
  ],
  group: ['order_item_id'],
  raw: true
});
```

## 性能改进效果

### 优化前
- **SKU冲突检查**: 如果有10个冲突SKU，需要 10+ 次数据库查询
- **需求单详情**: 如果需求单包含20个SKU，需要 20+ 次已发货数量查询

### 优化后
- **SKU冲突检查**: 不管多少冲突SKU，只需要 2 次数据库查询
- **需求单详情**: 不管需求单包含多少SKU，只需要 1 次已发货数量查询

### 预期效果
- 大幅减少数据库查询次数（从O(n)优化到O(1)）
- 显著缩短新建需求单的响应时间
- 提升用户体验，减少等待时间

## 技术细节

### 优化技术点
1. **批量查询**: 使用 `WHERE column IN (array)` 语法
2. **聚合函数**: 使用 `SUM()` 和 `GROUP BY` 计算总发货量
3. **映射关系**: 构建内存映射，避免重复查询
4. **保持兼容**: 确保优化后的业务逻辑与原逻辑完全一致

### 修改文件
- `backend/routes/orderManagement.js` (两处优化)

## 测试建议

1. **功能测试**: 确保优化后的SKU冲突检查和需求单详情查询功能正常
2. **性能测试**: 测试大量SKU情况下的响应时间改进
3. **回归测试**: 确保原有业务逻辑不受影响

## 部署说明

此优化为后端数据库查询优化，无需前端修改：
1. 更新后端代码到生产环境
2. 重启后端服务
3. 验证功能正常运行

优化完成日期: ${new Date().toLocaleDateString('zh-CN')} 