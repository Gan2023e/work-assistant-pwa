# local_boxes 表优化升级指南

## 概述

本次优化重新设计了 `local_boxes` 表的数据结构和使用方式，解决了原有设计的以下问题：
- 状态管理不清晰
- 出库时删除记录导致历史数据丢失
- 查询未发库存效率低
- 缺少完整的时间追踪
- 编辑和管理功能受限

## 主要改进

### 1. 数据库结构优化

#### 新增字段
```sql
-- 状态管理
status ENUM('待出库', '已出库', '已取消') DEFAULT '待出库'

-- 时间字段
last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
shipped_at TIMESTAMP NULL

-- 箱型标识
box_type ENUM('整箱', '混合箱') DEFAULT '整箱'

-- 操作备注
remark TEXT NULL
```

#### 记录号优化
- 原格式：随机字符串
- 新格式：`YYYYMMDDHHMM` + 序号 (如: `202501031425001`)
- 优势：包含入库时间信息，便于批次管理和时间范围查询

#### 混合箱管理
- 保留原有 `mix_box_num` 字段用于区分不同混合箱
- 新增 `box_type` 字段用于标识箱型
- 混合箱必须整箱出库，不支持部分出库

### 2. 业务逻辑优化

#### 状态管理
```
待出库 → 已出库 → (可回滚到) 待出库
                   ↓
                 已取消
```

#### 出库操作改进
- **原方式：** 删除 `local_boxes` 记录
- **新方式：** 更新状态为"已出库"，保留完整历史

#### 库存查询优化
```sql
-- 高效查询未发库存
SELECT sku, country, 
       SUM(CASE WHEN box_type = '整箱' THEN total_quantity ELSE 0 END) as whole_box_qty,
       SUM(CASE WHEN box_type = '混合箱' THEN total_quantity ELSE 0 END) as mixed_box_qty
FROM local_boxes 
WHERE status = '待出库'
GROUP BY sku, country;
```

## API 接口说明

### 新增的库存管理接口

#### 1. 获取未发库存
```
GET /api/inventory/pending
Query: sku, country, box_type, page, limit
```

#### 2. 获取库存记录详情
```
GET /api/inventory/records
Query: sku, country, mix_box_num, status, page, limit
```

#### 3. 创建库存记录
```
POST /api/inventory/create
Body: { records: [...], print: boolean }
```

#### 4. 创建混合箱
```
POST /api/inventory/create-mixed-box
Body: { mixBoxNum, skus: [...], operator, packer, print: boolean }
```

#### 5. 编辑库存
```
PUT /api/inventory/edit/:recordId
Body: { updateData: {...}, changeNote: string }
```

#### 6. 删除库存（软删除）
```
DELETE /api/inventory/delete/:recordId
Body: { reason: string }
```

#### 7. 取消出库
```
POST /api/inventory/cancel-shipment/:shipmentId
Body: { operator, reason }
```

## 打印功能

### 本地打印服务

#### 启动打印服务
```bash
# 在需要打印的电脑上运行
cd backend
node scripts/startPrintService.js [端口号]
```

#### 支持的打印方式
1. **HTML打印**：适用于普通打印机
2. **ZPL打印**：适用于斑马等专业标签打印机
3. **浏览器打印**：备用方案

#### 前端使用
```typescript
import { printManager } from '@/utils/printManager';

// 检查打印服务
const available = await printManager.checkPrintService();

// 打印单个标签
await printManager.printLabel(labelData);

// 批量打印
await printManager.printBatch(labelDataList);
```

## 使用指南

### 1. 入库操作

#### 整箱入库
```javascript
const record = {
    sku: 'ABC123',
    total_quantity: 100,
    total_boxes: 2,
    country: 'US',
    operator: '张三',
    packer: '李四',
    marketplace: 'Amazon'
};

// 创建记录并打印标签
const response = await fetch('/api/inventory/create', {
    method: 'POST',
    body: JSON.stringify({ records: [record], print: true })
});
```

#### 混合箱入库
```javascript
const mixedBox = {
    mixBoxNum: 'MIX001',
    skus: [
        { sku: 'ABC123', quantity: 50, country: 'US', marketplace: 'Amazon' },
        { sku: 'DEF456', quantity: 30, country: 'US', marketplace: 'Amazon' }
    ],
    operator: '张三',
    packer: '李四',
    print: true
};

const response = await fetch('/api/inventory/create-mixed-box', {
    method: 'POST',
    body: JSON.stringify(mixedBox)
});
```

### 2. 库存查询

#### 查看未发库存
```javascript
// 获取所有未发库存
const response = await fetch('/api/inventory/pending');

// 筛选查询
const response = await fetch('/api/inventory/pending?sku=ABC&country=US&box_type=整箱');
```

#### 查看库存历史
```javascript
// 查看某个SKU的完整历史
const response = await fetch('/api/inventory/records?sku=ABC123&country=US');
```

### 3. 出库操作

出库操作在现有的发货流程中进行，系统会自动：
1. 将相关库存状态从"待出库"改为"已出库"
2. 记录出库时间
3. 关联发货单ID
4. 保留完整的操作历史

### 4. 库存管理

#### 编辑库存
```javascript
const updateData = {
    total_quantity: 120,
    打包员: '王五'
};

const response = await fetch(`/api/inventory/edit/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify({ 
        updateData, 
        changeNote: '修正数量' 
    })
});
```

#### 删除库存
```javascript
const response = await fetch(`/api/inventory/delete/${recordId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason: '重复录入' })
});
```

## 数据迁移结果

执行数据库迁移后：
- ✅ 添加了新的状态和时间字段
- ✅ 现有数据自动迁移到新结构
- ✅ 创建了优化的索引
- ✅ 添加了数据约束
- ✅ 向后兼容现有查询

## 注意事项

### 1. 混合箱操作
- 混合箱必须整箱出库，不能部分出库
- 通过 `mix_box_num` 标识同一混合箱内的所有SKU
- 出库时需要选择整个混合箱，系统会自动处理所有相关记录

### 2. 状态管理
- 只有"待出库"状态的记录才能编辑
- "已出库"的记录可以通过"取消出库"功能恢复到"待出库"
- "已取消"状态的记录不会出现在库存统计中

### 3. 打印功能
- 推荐在需要打印的电脑上运行本地打印服务
- 如果本地服务不可用，会自动使用浏览器打印作为备用
- 支持批量打印，但会添加延迟避免打印冲突

### 4. 性能优化
- 新增的索引大幅提升了查询效率
- 状态字段避免了复杂的关联查询
- 时间字段支持高效的时间范围查询

## 技术细节

### 关键工具函数
- `generateRecordId()`: 生成基于时间的记录号
- `createInventoryRecord()`: 创建库存记录
- `updateInventoryRecord()`: 更新库存记录
- `shipInventoryRecords()`: 出库操作
- `cancelShipment()`: 取消出库
- `getPendingInventory()`: 获取未发库存

### 数据库约束
- 状态值约束
- 混合箱逻辑约束  
- 数量正数约束
- 出库状态一致性约束

### 错误处理
- 并发编辑检测
- 状态转换验证
- 数据完整性检查
- 打印服务降级处理

## 升级收益

1. **数据安全性**：不再丢失历史记录
2. **查询效率**：索引优化，状态查询更快
3. **操作灵活性**：支持编辑、删除、状态回滚
4. **管理能力**：完整的时间追踪和操作日志
5. **用户体验**：清晰的状态显示和批次管理
6. **扩展性**：为后续功能扩展奠定基础

此次优化在保持向后兼容的同时，大幅提升了库存管理的功能性和可靠性。 