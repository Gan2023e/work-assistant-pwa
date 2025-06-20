# Netlify部署指南

## 🌟 方法一：Git连接部署（推荐）

### 步骤1：准备Git仓库
```bash
# 初始化Git仓库（如果还没有）
git init
git add .
git commit -m "Initial commit: 工作助手PWA"

# 推送到GitHub
git remote add origin https://github.com/your-username/work-assistant-pwa.git
git push -u origin main
```

### 步骤2：Netlify部署设置
1. 访问 [Netlify](https://www.netlify.com/)
2. 点击 "Sign up" 注册账号（可用GitHub登录）
3. 点击 "New site from Git"
4. 选择 "GitHub" 并授权
5. 选择您的仓库 `work-assistant-pwa`

### 步骤3：构建配置
```
Site settings:
- Branch to deploy: main
- Build command: cd frontend && npm ci && npm run build-pwa
- Publish directory: frontend/build
```

### 步骤4：环境变量（如需要）
在 Site settings > Environment variables 中添加：
```
NODE_VERSION=16
NPM_VERSION=8
```

## ⚡ 方法二：拖拽部署

### 步骤1：本地构建
```bash
cd frontend
npm run build-pwa
```

### 步骤2：拖拽部署
1. 访问 [Netlify Drop](https://app.netlify.com/drop)
2. 将 `frontend/build` 文件夹拖拽到页面中
3. 等待部署完成

## 🔧 高级配置

### 创建 netlify.toml 配置文件
```toml
[build]
  command = "cd frontend && npm ci && npm run build-pwa"
  publish = "frontend/build"

[build.environment]
  NODE_VERSION = "16"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[headers]]
  for = "/manifest.json"
  [headers.values]
    Content-Type = "application/manifest+json"
```

## ✅ 部署后验证
1. 打开分配的域名（如：https://amazing-pwa-12345.netlify.app）
2. 检查HTTPS证书（应该显示绿色锁图标）
3. 使用Chrome DevTools > Application > Service Workers 检查PWA功能
4. 尝试离线模式测试 