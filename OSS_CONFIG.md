# 阿里云OSS配置指南

## 1. 开通阿里云OSS服务

### 1.1 注册阿里云账号
1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 注册并完成实名认证
3. 充值一定金额（OSS按量计费）

### 1.2 开通OSS服务
1. 登录阿里云控制台
2. 搜索并进入「对象存储 OSS」服务
3. 点击「立即开通」
4. 同意服务协议并开通

## 2. 创建OSS Bucket

### 2.1 创建存储空间
1. 在OSS控制台点击「创建 Bucket」
2. 填写以下信息：
   - **Bucket名称**：自定义，建议使用 `your-company-invoices`
   - **地域**：选择离你最近的地域，如 `华东1（杭州）`
   - **存储类型**：选择「标准存储」
   - **读写权限**：选择「私有」（推荐）
   - **服务端加密**：可选择开启
3. 点击「确定」创建

### 2.2 配置跨域访问（CORS）
1. 进入创建的Bucket
2. 点击「权限管理」→「跨域设置」
3. 点击「设置」，添加规则：
   - **来源**：`*`（或指定你的域名）
   - **允许 Methods**：`GET, POST, PUT, DELETE, HEAD`
   - **允许 Headers**：`*`
   - **暴露 Headers**：`ETag, x-oss-request-id`
4. 点击「确定」

## 3. 创建RAM用户（推荐）

### 3.1 创建RAM用户
1. 在控制台搜索「RAM」服务
2. 点击「用户」→「创建用户」
3. 填写信息：
   - **登录名称**：`oss-invoice-user`
   - **显示名称**：`OSS发票管理用户`
   - **访问方式**：勾选「编程访问」
4. 点击「确定」
5. **重要**：记录下 AccessKey ID 和 AccessKey Secret

### 3.2 授权RAM用户
1. 在用户列表找到刚创建的用户
2. 点击「添加权限」
3. 选择「AliyunOSSFullAccess」权限
4. 点击「确定」

## 4. 配置环境变量

### 4.1 后端环境变量
在你的后端项目中设置以下环境变量：

```bash
# 阿里云OSS配置
OSS_REGION=oss-cn-hangzhou          # 你的OSS地域
OSS_ACCESS_KEY_ID=your_access_key_id       # RAM用户的AccessKey ID
OSS_ACCESS_KEY_SECRET=your_access_key_secret   # RAM用户的AccessKey Secret
OSS_BUCKET=your-company-invoices    # 你的Bucket名称
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com  # OSS地域端点
```

### 4.2 本地开发配置
创建 `.env` 文件（如果不存在）：

```bash
# 在 backend/.env 文件中添加
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your-company-invoices
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
```

### 4.3 生产环境配置
在你的部署平台（如Railway、Vercel等）中设置相同的环境变量。

## 5. 测试配置

### 5.1 启动应用
启动后端服务后，查看控制台输出：
- 如果看到 `✅ OSS配置检查通过`，说明配置正确
- 如果看到 `⚠️ OSS配置缺失`，说明环境变量未正确设置

### 5.2 测试上传
1. 登录应用
2. 进入「采购发票管理」页面
3. 创建发票并上传PDF文件
4. 如果上传成功，说明OSS配置正确

## 6. 常见问题

### 6.1 上传失败
- 检查环境变量是否正确设置
- 确认RAM用户有足够的权限
- 检查网络连接

### 6.2 文件无法访问
- 确认Bucket权限设置
- 检查CORS配置
- 确认文件确实已上传到OSS

### 6.3 费用问题
- OSS按量计费，主要包括：
  - 存储费用：按存储容量计算
  - 流量费用：按下载流量计算
  - 请求费用：按请求次数计算
- 建议设置费用预警避免超支

## 7. 安全建议

1. **使用RAM用户**：不要使用主账号的AccessKey
2. **最小权限原则**：只授予必要的权限
3. **定期轮换密钥**：定期更换AccessKey
4. **私有Bucket**：发票文件建议使用私有Bucket
5. **HTTPS访问**：确保使用HTTPS协议上传和访问文件

## 8. 费用优化

1. **生命周期管理**：设置文件自动删除或转为低频存储
2. **压缩存储**：上传前压缩文件
3. **CDN加速**：如需频繁访问，可配置CDN
4. **监控费用**：定期查看费用明细

---

配置完成后，你的采购发票管理系统就可以正常使用文件上传功能了！ 