-- ====================================
-- 重量字段完整数据库执行脚本
-- 执行时间：请在数据库后台手动执行
-- ====================================

USE your_database_name;

-- 第一步：备份数据（强烈建议）
-- 取消注释下面的语句来创建备份表
-- CREATE TABLE sellerinventory_sku_backup AS SELECT * FROM sellerinventory_sku;

-- 第二步：添加或修改重量字段（单位：千克，支持小数点后3位）
-- 如果是新安装，使用ADD COLUMN
-- 如果是从克单位升级，使用MODIFY COLUMN

-- 方案A：新安装（字段不存在时）
-- ALTER TABLE sellerinventory_sku 
-- ADD COLUMN weight DECIMAL(8, 3) NULL 
-- COMMENT '产品重量(千克)';

-- 方案B：从克单位升级（字段已存在时）
ALTER TABLE sellerinventory_sku 
MODIFY COLUMN weight DECIMAL(8, 3) NULL 
COMMENT '产品重量(千克)';

-- 第三步：添加重量类型字段（如果尚未添加）
-- 检查字段是否存在，不存在则添加
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'sellerinventory_sku' 
    AND COLUMN_NAME = 'weight_type'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE sellerinventory_sku ADD COLUMN weight_type ENUM(''estimated'', ''measured'') NULL DEFAULT ''estimated'' COMMENT ''重量类型：estimated-预估, measured-实测'';',
    'SELECT ''weight_type字段已存在，跳过添加'' as message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 第四步：数据转换（从克转千克）
-- 只转换非空且大于0的重量数据
UPDATE sellerinventory_sku 
SET weight = ROUND(weight / 1000, 3) 
WHERE weight IS NOT NULL 
  AND weight > 0 
  AND weight > 1; -- 只转换明显是克单位的数据（大于1的值）

-- 第五步：验证结果
SELECT '=== 转换结果统计 ===' as info;

SELECT 
    COUNT(*) as 总记录数,
    COUNT(weight) as 有重量数据的记录数,
    ROUND(MIN(weight), 3) as 最小重量_kg,
    ROUND(MAX(weight), 3) as 最大重量_kg,
    ROUND(AVG(weight), 3) as 平均重量_kg
FROM sellerinventory_sku;

SELECT '=== 重量数据示例 ===' as info;

SELECT 
    child_sku, 
    weight as 重量_kg, 
    weight_type as 重量类型
FROM sellerinventory_sku 
WHERE weight IS NOT NULL 
ORDER BY weight DESC 
LIMIT 10;

-- 第六步：查看表结构确认
SELECT '=== 表结构确认 ===' as info;
DESCRIBE sellerinventory_sku;

-- ====================================
-- 执行说明：
-- 1. 请将"your_database_name"替换为实际的数据库名称
-- 2. 建议先执行备份语句
-- 3. 根据实际情况选择方案A或方案B
-- 4. 脚本会自动检查字段是否存在并相应处理
-- 5. 只转换大于1的重量值（假设是克单位）
-- ==================================== 