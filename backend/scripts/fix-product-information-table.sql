-- 修复 product_information 表结构
-- 这个脚本可以在数据库后台手动执行

-- 方案1：如果表不存在，创建新表
CREATE TABLE IF NOT EXISTS `product_information` (
  `site` varchar(10) NOT NULL COMMENT '站点/国家信息',
  `item_sku` varchar(30) NOT NULL COMMENT '商品SKU',
  `original_parent_sku` varchar(30) DEFAULT NULL COMMENT '原始父SKU，去掉前两个字符后的结果',
  `item_name` varchar(255) DEFAULT NULL COMMENT '商品名称',
  `external_product_id` varchar(30) DEFAULT NULL,
  `external_product_id_type` varchar(30) DEFAULT NULL,
  `brand_name` varchar(30) DEFAULT NULL,
  `product_description` text,
  `bullet_point1` varchar(255) DEFAULT NULL,
  `bullet_point2` varchar(255) DEFAULT NULL,
  `bullet_point3` varchar(255) DEFAULT NULL,
  `bullet_point4` varchar(255) DEFAULT NULL,
  `bullet_point5` varchar(255) DEFAULT NULL,
  `generic_keywords` varchar(255) DEFAULT NULL,
  `main_image_url` varchar(255) DEFAULT NULL,
  `swatch_image_url` varchar(255) DEFAULT NULL,
  `other_image_url1` varchar(255) DEFAULT NULL,
  `other_image_url2` varchar(255) DEFAULT NULL,
  `other_image_url3` varchar(255) DEFAULT NULL,
  `other_image_url4` varchar(255) DEFAULT NULL,
  `other_image_url5` varchar(255) DEFAULT NULL,
  `other_image_url6` varchar(255) DEFAULT NULL,
  `other_image_url7` varchar(255) DEFAULT NULL,
  `other_image_url8` varchar(255) DEFAULT NULL,
  `parent_child` varchar(30) DEFAULT NULL,
  `parent_sku` varchar(30) DEFAULT NULL,
  `relationship_type` varchar(30) DEFAULT NULL,
  `variation_theme` varchar(30) DEFAULT NULL,
  `color_name` varchar(30) DEFAULT NULL,
  `color_map` varchar(30) DEFAULT NULL,
  `size_name` varchar(30) DEFAULT NULL,
  `size_map` varchar(30) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`site`, `item_sku`),
  KEY `idx_original_parent_sku` (`original_parent_sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 方案2：如果表已存在但缺少字段，添加字段
-- 检查表是否存在且缺少 created_at 字段
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'product_information' 
   AND COLUMN_NAME = 'created_at') = 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'product_information') = 1,
  'ALTER TABLE product_information ADD COLUMN created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP;',
  'SELECT "created_at字段已存在或表不存在" as message;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查表是否存在且缺少 updated_at 字段
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'product_information' 
   AND COLUMN_NAME = 'updated_at') = 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'product_information') = 1,
  'ALTER TABLE product_information ADD COLUMN updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;',
  'SELECT "updated_at字段已存在或表不存在" as message;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 方案3：检查并修复主键（如果需要从id主键改为复合主键）
-- 注意：这个操作会删除原有数据，请在执行前备份
-- 
-- 如果发现表使用的是id主键而不是复合主键，可以手动执行以下操作：
-- 
-- 1. 备份数据：
--    CREATE TABLE product_information_backup AS SELECT * FROM product_information;
-- 
-- 2. 删除原表：
--    DROP TABLE product_information;
-- 
-- 3. 重新创建表（使用上面的方案1的SQL）
-- 
-- 4. 恢复数据（如果需要）：
--    INSERT INTO product_information 
--    SELECT site, item_sku, original_parent_sku, item_name, external_product_id, 
--           external_product_id_type, brand_name, product_description, bullet_point1, 
--           bullet_point2, bullet_point3, bullet_point4, bullet_point5, generic_keywords,
--           main_image_url, swatch_image_url, other_image_url1, other_image_url2, 
--           other_image_url3, other_image_url4, other_image_url5, other_image_url6,
--           other_image_url7, other_image_url8, parent_child, parent_sku, relationship_type,
--           variation_theme, color_name, color_map, size_name, size_map,
--           COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
--    FROM product_information_backup 
--    WHERE site IS NOT NULL AND item_sku IS NOT NULL;

-- 验证表结构
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_KEY,
  EXTRA
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'product_information'
ORDER BY ORDINAL_POSITION; 