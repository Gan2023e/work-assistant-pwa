# 📦 部分出库功能使用指南

## 🎯 功能概述

新的部分出库功能解决了整箱货物只需要出库部分数量的问题，通过扩展`local_boxes`表的状态管理，实现了更精确的库存跟踪。

## 🏗️ 数据库结构变更

### 新增字段

```sql
-- local_boxes 表新增字段
shipped_quantity INTEGER DEFAULT 0 COMMENT '已出库数量'
remaining_quantity VIRTUAL COMMENT '剩余数量(虚拟字段)'
```

### 状态字段扩展

```sql
-- status 字段新增枚举值
status ENUM('待出库', '部分出库', '已出库', '已取消')
```

## 📊 状态逻辑说明

| 状态 | 条件 | 说明 |
|------|------|------|
| `待出库` | `shipped_quantity = 0` | 完全未出库 |
| `部分出库` | `0 < shipped_quantity < total_quantity` | 已出库部分，还有剩余 |
| `已出库` | `shipped_quantity = total_quantity` | 完全出库 |
| `已取消` | 手动标记 | 已取消的库存 |

## 🔧 核心功能

### 1. 自动状态管理
- 系统根据`shipped_quantity`和`total_quantity`的关系自动更新`status`
- `remaining_quantity`虚拟字段自动计算剩余数量

### 2. 先进先出(FIFO)出库
- 按入库时间优先出库较早的记录
- 智能分配出库数量到多个库存记录

### 3. 库存查询优化
- 直接通过`status`字段查询库存状态
- 无需复杂的正负数汇总计算

## 🚀 使用方法

### 执行数据库迁移

```bash
# 进入后端目录
cd backend

# 执行迁移脚本
node scripts/runPartialShipmentMigration.js
```

### 查询库存状态

```sql
-- 查看所有在库货件
SELECT * FROM local_boxes WHERE status IN ('待出库', '部分出库');

-- 查看部分出库的货件
SELECT sku, country, total_quantity, shipped_quantity, 
       (total_quantity - shipped_quantity) as remaining_quantity
FROM local_boxes 
WHERE status = '部分出库';

-- 按SKU汇总库存
SELECT sku, country, 
       SUM(total_quantity) as total_qty,
       SUM(shipped_quantity) as shipped_qty,
       SUM(total_quantity - shipped_quantity) as remaining_qty
FROM local_boxes 
WHERE status IN ('待出库', '部分出库')
GROUP BY sku, country;
```

## 🔌 API端点

### 1. 库存状态汇总
```http
GET /api/shipping/inventory-status-summary

# 查询参数
?country=美国&sku=ABC123&status=部分出库
```

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "summary": [
      {
        "sku": "ABC123",
        "country": "美国", 
        "status": "部分出库",
        "total_quantity": "100",
        "shipped_quantity": "30",
        "remaining_quantity": "70",
        "record_count": "2"
      }
    ],
    "statistics": {
      "total_records": 50,
      "status_counts": {
        "待出库": 30,
        "部分出库": 15,
        "已出库": 5
      },
      "total_quantity": 1000,
      "total_shipped": 300,
      "total_remaining": 700
    }
  }
}
```

### 2. 检查SKU部分出库状态
```http
GET /api/shipping/check-partial-shipment/ABC123/美国
```

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "hasPartialShipment": true,
    "totalRecords": 2,
    "totalQuantity": 100,
    "shippedQuantity": 30,
    "remainingQuantity": 70,
    "records": [
      {
        "记录号": "IN-123456",
        "total_quantity": 60,
        "shipped_quantity": 20,
        "remaining_quantity": 40,
        "time": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## 📈 使用场景

### 场景1：整箱部分出库
```
入库记录: SKU-ABC, 数量=100箱
需求1: 出库30箱 → status='部分出库', shipped_quantity=30, remaining_quantity=70
需求2: 再出库70箱 → status='已出库', shipped_quantity=100, remaining_quantity=0
```

### 场景2：多批次库存FIFO出库
```
入库记录1: SKU-ABC, 数量=50, 时间=2024-01-01
入库记录2: SKU-ABC, 数量=30, 时间=2024-01-02

出库需求: 60件
结果:
- 记录1: shipped_quantity=50, status='已出库'
- 记录2: shipped_quantity=10, status='部分出库', remaining_quantity=20
```

## ⚠️ 注意事项

1. **虚拟字段**: `remaining_quantity`是虚拟字段，不存储在数据库中，每次查询时动态计算
2. **索引优化**: 新增索引`idx_status_shipped_quantity`优化查询性能
3. **事务保证**: 所有出库操作在事务中执行，确保数据一致性
4. **历史兼容**: 现有数据会自动迁移，不影响历史记录

## 🔄 与现有系统集成

### 发货操作集成
- "完成"按钮现在使用新的部分出库逻辑
- 自动按FIFO原则分配库存
- 支持跨多个库存记录的智能出库

### 库存查询集成
- 所有库存查询API自动支持新的状态字段
- 前端可直接使用`status`字段进行筛选
- 无需修改现有的库存显示逻辑

## 🎉 优势总结

✅ **状态清晰**: 通过`status`字段直观了解库存状态  
✅ **数量精确**: `shipped_quantity`和`remaining_quantity`提供精确的数量信息  
✅ **查询高效**: 无需复杂汇总计算，直接查询即可  
✅ **逻辑智能**: FIFO出库和自动状态管理  
✅ **扩展性强**: 支持未来更复杂的库存管理需求  
✅ **兼容性好**: 不影响现有功能，平滑升级  

这个设计完美解决了你提出的两个核心问题：
1. 通过`status`字段清楚知道哪些货件在仓库
2. 方便知道"部分出库"的SKU和剩余数量 