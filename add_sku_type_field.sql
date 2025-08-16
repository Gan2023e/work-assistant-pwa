-- 为pbi_amzsku_sku表添加sku_type字段
-- 这个脚本用于修复新录入数据中sku_type为空的问题

-- 1. 添加sku_type字段
ALTER TABLE pbi_amzsku_sku 
ADD COLUMN sku_type VARCHAR(20) COMMENT 'SKU类型，默认为FBA SKU';

-- 2. 为现有记录设置默认值
UPDATE pbi_amzsku_sku 
SET sku_type = 'FBA SKU' 
WHERE sku_type IS NULL OR sku_type = '';

-- 3. 验证字段添加结果
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN sku_type IS NOT NULL AND sku_type != '' THEN 1 END) as records_with_sku_type,
    COUNT(CASE WHEN sku_type = 'FBA SKU' THEN 1 END) as fba_sku_records,
    COUNT(CASE WHEN sku_type IS NULL OR sku_type = '' THEN 1 END) as records_without_sku_type
FROM pbi_amzsku_sku;

-- 4. 显示一些示例数据
SELECT 
    amz_sku,
    local_sku,
    country,
    site,
    sku_type,
    update_time
FROM pbi_amzsku_sku 
LIMIT 10;

-- 5. 检查字段结构
DESCRIBE pbi_amzsku_sku; 