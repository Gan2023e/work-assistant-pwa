-- 采购发票管理系统数据表创建脚本
-- 创建时间: 2024-01-15

-- 1. 创建发票表 (invoices)
-- 必须先创建发票表，因为采购订单表引用了发票表的ID
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '发票ID',
  `invoice_number` varchar(50) NOT NULL COMMENT '发票号',
  `invoice_date` date NOT NULL COMMENT '开票日期',
  `total_amount` decimal(10,2) NOT NULL COMMENT '发票总金额',
  `tax_amount` decimal(10,2) DEFAULT NULL COMMENT '税额',
  `invoice_file_url` varchar(500) DEFAULT NULL COMMENT '发票文件OSS链接',
  `invoice_file_name` varchar(200) DEFAULT NULL COMMENT '发票文件名',
  `file_size` int(11) DEFAULT NULL COMMENT '文件大小（字节）',
  `seller_name` varchar(100) NOT NULL COMMENT '开票方名称',
  `buyer_name` varchar(100) DEFAULT NULL COMMENT '收票方名称',
  `invoice_type` enum('增值税专用发票','增值税普通发票','收据','其他') NOT NULL DEFAULT '增值税专用发票' COMMENT '发票类型',
  `status` enum('正常','作废','红冲') NOT NULL DEFAULT '正常' COMMENT '发票状态',
  `remarks` text DEFAULT NULL COMMENT '备注信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoice_number` (`invoice_number`),
  KEY `idx_seller_name` (`seller_name`),
  KEY `idx_invoice_date` (`invoice_date`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发票管理表';

-- 2. 创建采购订单表 (purchase_orders)
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '采购订单ID',
  `order_number` varchar(50) NOT NULL COMMENT '采购订单号',
  `order_date` date NOT NULL COMMENT '订单日期',
  `amount` decimal(10,2) NOT NULL COMMENT '订单金额',
  `seller_name` varchar(100) NOT NULL COMMENT '卖家名称',
  `payment_account` varchar(100) NOT NULL COMMENT '支付账户',
  `invoice_status` enum('未开票','已开票','部分开票') NOT NULL DEFAULT '未开票' COMMENT '开票情况',
  `invoice_id` int(11) DEFAULT NULL COMMENT '关联的发票ID',
  `remarks` text DEFAULT NULL COMMENT '备注信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_number` (`order_number`),
  KEY `idx_seller_name` (`seller_name`),
  KEY `idx_invoice_status` (`invoice_status`),
  KEY `idx_order_date` (`order_date`),
  KEY `fk_purchase_orders_invoice_id` (`invoice_id`),
  CONSTRAINT `fk_purchase_orders_invoice_id` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采购订单管理表';

-- 3. 插入一些示例数据（可选）
-- 插入示例发票数据
INSERT INTO `invoices` (`invoice_number`, `invoice_date`, `total_amount`, `tax_amount`, `seller_name`, `buyer_name`, `invoice_type`, `status`, `remarks`) VALUES
('INV20240101001', '2024-01-01', 1000.00, 130.00, '示例供应商A', '我司', '增值税专用发票', '正常', '测试发票数据'),
('INV20240102001', '2024-01-02', 2000.00, 260.00, '示例供应商B', '我司', '增值税专用发票', '正常', '测试发票数据2');

-- 插入示例采购订单数据
INSERT INTO `purchase_orders` (`order_number`, `order_date`, `amount`, `seller_name`, `payment_account`, `invoice_status`, `invoice_id`, `remarks`) VALUES
('PO20240101001', '2024-01-01', 500.00, '示例供应商A', '支付宝账户', '已开票', 1, '测试采购订单1'),
('PO20240101002', '2024-01-01', 500.00, '示例供应商A', '支付宝账户', '已开票', 1, '测试采购订单2'),
('PO20240102001', '2024-01-02', 1000.00, '示例供应商B', '银行转账', '未开票', NULL, '测试采购订单3'),
('PO20240102002', '2024-01-02', 800.00, '示例供应商C', '微信支付', '未开票', NULL, '测试采购订单4');

-- 完成提示
SELECT '采购发票管理数据表创建完成！' as message; 