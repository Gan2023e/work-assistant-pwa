# Vercel部署指南

## 🚀 方法一：Vercel CLI部署

### 步骤1：安装Vercel CLI
```bash
npm install -g vercel
```

### 步骤2：登录Vercel
```bash
vercel login
```

### 步骤3：项目部署
```bash
# 在项目根目录运行
vercel

# 按提示配置：
# Set up and deploy "~/work-assistant-pwa"? [Y/n] y
# Which scope do you want to deploy to? [选择您的账号]
# Link to existing project? [Y/n] n
# What's your project's name? work-assistant-pwa
# In which directory is your code located? ./
```

## 📁 方法二：Git连接部署

### 步骤1：创建vercel.json配置
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "buildCommand": "npm run build-pwa",
        "outputDirectory": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/service-worker.js",
      "headers": {
        "cache-control": "max-age=0"
      }
    },
    {
      "src": "/sw.js",
      "headers": {
        "cache-control": "max-age=0"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 步骤2：通过Git部署
1. 推送代码到GitHub
2. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
3. 点击 "New Project"
4. 选择GitHub仓库
5. Vercel会自动检测配置并部署

## 🔧 环境配置

### package.json修改（frontend目录）
```json
{
  "scripts": {
    "build": "react-scripts build && npm run copy-sw",
    "vercel-build": "npm run build-pwa"
  }
}
```

## ✅ 部署完成
部署成功后，您会获得：
- 生产域名：https://work-assistant-pwa.vercel.app
- 自动HTTPS证书
- 全球CDN加速
- 自动重新部署（Git推送时） 