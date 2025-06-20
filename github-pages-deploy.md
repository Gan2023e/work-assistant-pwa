# GitHub Pages部署指南

## 📝 准备工作

### 步骤1：推送代码到GitHub
```bash
# 创建GitHub仓库并推送代码
git init
git add .
git commit -m "工作助手PWA初始版本"
git branch -M main
git remote add origin https://github.com/your-username/work-assistant-pwa.git
git push -u origin main
```

## 🔧 方法一：GitHub Actions自动部署（推荐）

### 步骤1：创建部署工作流
创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy PWA to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
        
    - name: Install dependencies
      run: |
        cd frontend
        npm ci
        
    - name: Build PWA
      run: |
        cd frontend
        npm run build-pwa
        
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./frontend/build
        cname: your-domain.com  # 如果有自定义域名
```

### 步骤2：启用GitHub Pages
1. 进入GitHub仓库设置页面
2. 滚动到 "Pages" 部分
3. Source选择 "Deploy from a branch"
4. Branch选择 "gh-pages"
5. 点击Save

## 🛠️ 方法二：手动部署

### 步骤1：安装gh-pages
```bash
cd frontend
npm install --save-dev gh-pages
```

### 步骤2：配置package.json
```json
{
  "homepage": "https://your-username.github.io/work-assistant-pwa",
  "scripts": {
    "predeploy": "npm run build-pwa",
    "deploy": "gh-pages -d build"
  }
}
```

### 步骤3：部署
```bash
cd frontend
npm run deploy
```

## 🔒 启用HTTPS

GitHub Pages默认支持HTTPS，确保：
1. 在仓库设置中勾选 "Enforce HTTPS"
2. 访问 https://your-username.github.io/work-assistant-pwa

## 🌐 自定义域名（可选）

### 步骤1：添加CNAME文件
在 `frontend/public/` 目录创建 `CNAME` 文件：
```
your-domain.com
```

### 步骤2：配置DNS
在域名提供商处添加CNAME记录：
```
www -> your-username.github.io
```

### 步骤3：GitHub设置
在仓库Settings > Pages中设置自定义域名。

## ⚠️ 注意事项

1. **构建时间**：首次部署可能需要几分钟
2. **缓存**：更新可能需要等待CDN刷新
3. **路径问题**：确保所有资源路径正确
4. **Service Worker**：确保sw.js正确复制到根目录 