-- ====================================
-- 重量数据单位转换：从克转换为千克
-- 执行时间：在数据库字段修改完成后手动执行
-- ====================================

-- 备份当前数据（可选，建议执行前备份）
-- CREATE TABLE sellerinventory_sku_backup AS SELECT * FROM sellerinventory_sku;

-- 1. 如果weight字段已经存在且包含克数据，先修改字段类型以支持小数
-- （如果字段是新创建的，跳过此步骤）
ALTER TABLE sellerinventory_sku 
MODIFY COLUMN weight DECIMAL(8, 3) NULL 
COMMENT '产品重量(千克)';

-- 2. 将现有的克数据转换为千克（除以1000）
-- 只转换非空且大于0的重量数据
UPDATE sellerinventory_sku 
SET weight = ROUND(weight / 1000, 3) 
WHERE weight IS NOT NULL AND weight > 0;

-- 3. 检查转换结果
-- 查看转换后的数据分布
SELECT 
    COUNT(*) as total_records,
    COUNT(weight) as records_with_weight,
    MIN(weight) as min_weight_kg,
    MAX(weight) as max_weight_kg,
    AVG(weight) as avg_weight_kg
FROM sellerinventory_sku;

-- 4. 查看前10条有重量数据的记录，确认转换正确
SELECT 
    child_sku, 
    weight, 
    weight_type 
FROM sellerinventory_sku 
WHERE weight IS NOT NULL 
ORDER BY weight DESC 
LIMIT 10;

-- ====================================
-- 转换说明：
-- 1. 将所有重量数据从克转换为千克（除以1000）
-- 2. 保留3位小数精度
-- 3. 只处理非空且大于0的重量数据
-- 4. 建议执行前备份数据表
-- ==================================== 