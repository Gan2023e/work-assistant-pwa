-- ==========================================================
-- 日发货详情功能数据库更新 SQL
-- 日期: 2024年
-- 功能: 为 sellerinventory_sku 表添加 vendor_sku 字段
-- ==========================================================

-- 为 sellerinventory_sku 表添加 vendor_sku 字段
-- 用于与 supplier_shipments_peak_season 表的 卖家货号 字段关联
ALTER TABLE `sellerinventory_sku` 
ADD COLUMN `vendor_sku` VARCHAR(15) NULL COMMENT '厂商货号，用于关联发货记录' 
AFTER `child_sku`;

-- 为新字段添加索引以提高查询性能
ALTER TABLE `sellerinventory_sku` 
ADD INDEX `idx_vendor_sku` (`vendor_sku`);

-- 查询当前表结构确认字段已添加
DESCRIBE `sellerinventory_sku`;

-- ==========================================================
-- 使用说明:
-- 1. 执行以上SQL语句添加字段
-- 2. 在 sellerinventory_sku 表的 vendor_sku 字段中填入对应的厂商货号
-- 3. 这个字段将用于关联 supplier_shipments_peak_season 表的 卖家货号 字段
-- 4. 通过三表关联获取厂家名称信息:
--    supplier_shipments_peak_season.卖家货号 = sellerinventory_sku.vendor_sku
--    sellerinventory_sku.parent_sku = product_weblink.parent_sku
--    获取 product_weblink.seller_name 作为厂家名称
-- ========================================================= 