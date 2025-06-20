-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS work_assistant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE work_assistant;

-- 产品链接表
CREATE TABLE IF NOT EXISTS product_weblinks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT '产品名称',
  url TEXT NOT NULL COMMENT '产品链接',
  category VARCHAR(100) COMMENT '产品分类',
  price DECIMAL(10,2) COMMENT '价格',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='产品链接管理表';

-- 物流信息表
CREATE TABLE IF NOT EXISTS logistics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_number VARCHAR(100) NOT NULL COMMENT '运单号',
  carrier VARCHAR(100) NOT NULL COMMENT '承运商',
  origin VARCHAR(255) COMMENT '发货地',
  destination VARCHAR(255) COMMENT '目的地',
  status ENUM('pending', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending' COMMENT '物流状态',
  estimated_delivery DATE COMMENT '预计到达时间',
  actual_delivery DATE COMMENT '实际到达时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='物流管理表';

-- 工资记录表
CREATE TABLE IF NOT EXISTS salaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_name VARCHAR(100) NOT NULL COMMENT '员工姓名',
  work_date DATE NOT NULL COMMENT '工作日期',
  hours_worked DECIMAL(5,2) NOT NULL COMMENT '工作小时数',
  hourly_rate DECIMAL(8,2) NOT NULL COMMENT '小时工资',
  total_amount DECIMAL(10,2) NOT NULL COMMENT '总金额',
  status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending' COMMENT '支付状态',
  notes TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='工资记录表';

-- 包装盒本地化表
CREATE TABLE IF NOT EXISTS local_boxes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  box_type VARCHAR(100) NOT NULL COMMENT '盒子类型',
  dimensions VARCHAR(100) COMMENT '尺寸规格',
  cost DECIMAL(8,2) NOT NULL COMMENT '成本',
  supplier VARCHAR(255) COMMENT '供应商',
  stock_quantity INT DEFAULT 0 COMMENT '库存数量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='包装盒本地化表';

-- 包装价格表
CREATE TABLE IF NOT EXISTS package_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_type VARCHAR(100) NOT NULL COMMENT '包装类型',
  size_category VARCHAR(50) COMMENT '尺寸分类',
  base_price DECIMAL(8,2) NOT NULL COMMENT '基础价格',
  additional_fee DECIMAL(8,2) DEFAULT 0 COMMENT '附加费用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='包装价格表'; 