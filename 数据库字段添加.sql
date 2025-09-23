-- ====================================
-- 为 sellerinventory_sku 表添加重量相关字段
-- 执行时间：请在数据库后台手动执行
-- ====================================

-- 1. 添加重量字段（单位：千克，支持小数点后3位）
ALTER TABLE sellerinventory_sku 
ADD COLUMN weight DECIMAL(8, 3) NULL 
COMMENT '产品重量(千克)';

-- 2. 添加重量类型字段（枚举类型：预估/实测）
ALTER TABLE sellerinventory_sku 
ADD COLUMN weight_type ENUM('estimated', 'measured') NULL DEFAULT 'estimated' 
COMMENT '重量类型：estimated-预估, measured-实测';

-- 3. 查看表结构确认字段已添加
DESCRIBE sellerinventory_sku;

-- ====================================
-- 字段说明：
-- weight: DECIMAL(8,3) 类型，可存储最大99999.999千克的重量，允许NULL
-- weight_type: ENUM类型，只能是'estimated'(预估)或'measured'(实测)，默认'estimated'
-- ==================================== 