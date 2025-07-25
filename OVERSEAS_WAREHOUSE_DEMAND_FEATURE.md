# 海外仓补货需求功能

## 功能概述
在"需求单管理"页面新增了"添加需求单"功能，允许用户创建海外仓补货需求并自动发送钉钉通知。

## 使用方法

### 1. 打开需求单管理页面
- 导航到 发货管理 > 需求单管理

### 2. 点击"添加需求单"按钮
- 在需求单列表页面，点击绿色的"添加需求单"按钮

### 3. 填写需求单信息
对话框包含以下字段：
- **目的国**: 下拉选择（美国、英国、加拿大、阿联酋、澳大利亚）
- **物流方式**: 下拉选择（盐田海运、美森海运、空运、快递）
- **平台**: 下拉选择（亚马逊、Shein）
- **发货截止日**: 日期选择器
- **预计售完日**: 日期选择器
- **SKU及发货数量**: 多行文本框，格式为每行一个"SKU 数量"

### 4. SKU数据格式示例
```
AGXB362D1 44
NAXBA968H 32
ABC123DEF 15
```

### 5. 提交需求单
- 点击"确定"按钮提交
- 系统会自动生成需求单号（格式：XQ+日期+序号）
- 成功后会刷新需求单列表

## 钉钉通知
提交成功后，系统会自动发送钉钉通知，通知内容包括：
- 截止日期
- 目的国
- 物流方式
- 销售平台
- SKU及数量列表
- @MOBILE_NUM_MOM

## 技术实现

### 前端
- 文件：`frontend/src/pages/Shipping/OrderManagementPage.tsx`
- 新增了添加需求单的Modal对话框
- 使用Antd的Form、Select、DatePicker等组件
- 处理日期格式转换

### 后端
- 文件：`backend/routes/orderManagement.js`
- 新增POST `/api/order-management/orders` 接口
- 自动生成需求单号
- 解析SKU数据并批量创建记录
- 集成钉钉通知功能

### 数据库
- 表：`pbi_warehouse_products_need`
- 新记录会设置默认状态为"待发货"

## 环境变量配置
需要配置以下环境变量以启用钉钉通知：
- `DINGTALK_WEBHOOK`: 钉钉机器人Webhook地址
- `SECRET_KEY`: 钉钉机器人签名密钥（可选）
- `MOBILE_NUM_MOM`: @的手机号

## 错误处理
- 表单验证：确保所有必填字段都已填写
- SKU格式验证：检查SKU和数量的格式
- 数量验证：确保数量为正整数
- 钉钉通知失败不会影响需求单创建成功 