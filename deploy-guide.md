# 工作助手PWA - 部署指南

## 🚀 快速部署

### 1. 本地测试

```bash
# 构建PWA应用
cd frontend
npm run build-pwa

# 启动测试服务器
npm run serve
# 或者
node test-pwa.js
```

### 2. 使用Netlify部署（推荐）

1. 注册 [Netlify](https://www.netlify.com/) 账号
2. 将代码推送到GitHub仓库
3. 在Netlify中连接GitHub仓库
4. 设置构建配置：
   - Build command: `cd frontend && npm run build-pwa`
   - Publish directory: `frontend/build`
5. 部署完成后，Netlify会自动提供HTTPS

### 3. 使用Vercel部署

1. 注册 [Vercel](https://vercel.com/) 账号
2. 安装Vercel CLI: `npm install -g vercel`
3. 在项目根目录运行: `vercel`
4. 创建 `vercel.json` 配置文件：

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
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 4. 使用GitHub Pages部署

1. 安装gh-pages: `npm install --save-dev gh-pages`
2. 在package.json中添加：
```json
{
  "scripts": {
    "predeploy": "npm run build-pwa",
    "deploy": "gh-pages -d build"
  }
}
```
3. 运行: `npm run deploy`

## ✅ PWA检查清单

部署后请确认以下功能：

- [ ] 应用可以通过HTTPS访问
- [ ] Service Worker正确注册
- [ ] 离线功能正常工作
- [ ] 安装提示正常显示
- [ ] 应用可以添加到主屏幕
- [ ] 网络状态指示器正常工作
- [ ] 推送通知功能（如需要）

## 🔧 PWA性能优化

### Lighthouse审计

使用Chrome DevTools中的Lighthouse来审计PWA：

1. 打开Chrome DevTools
2. 点击"Lighthouse"标签
3. 选择"Progressive Web App"
4. 点击"Generate report"

### 性能指标目标

- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 90
- PWA: > 90

## 📱 设备测试

### 移动设备测试

1. **Android**:
   - Chrome浏览器
   - 测试安装功能
   - 测试离线模式

2. **iOS**:
   - Safari浏览器
   - 测试添加到主屏幕
   - 测试全屏模式

### 桌面测试

1. **Chrome**:
   - 测试安装功能
   - 测试离线模式
   - 测试更新机制

2. **Edge**:
   - 测试基本PWA功能

## 🐛 常见问题解决

### Service Worker不工作

1. 确认HTTPS环境
2. 检查控制台错误信息
3. 清除浏览器缓存

### 安装提示不显示

1. 确认manifest.json配置正确
2. 检查PWA要求是否满足
3. 使用Lighthouse检查PWA得分

### 离线模式异常

1. 检查sw.js中的缓存策略
2. 确认offline.html文件存在
3. 测试网络断开场景

## 📊 监控和分析

### 推荐工具

- Google Analytics (PWA事件追踪)
- Workbox Analytics
- Firebase Performance Monitoring

### 关键指标

- 安装率
- 离线访问次数
- Service Worker缓存命中率
- 页面加载速度

## 🔄 更新策略

### 版本管理

1. 更新manifest.json中的版本号
2. 修改Service Worker缓存名称
3. 部署新版本

### 用户通知

应用会自动检测更新并提示用户，无需手动干预。

## 📞 技术支持

如遇到部署问题，请：

1. 查看浏览器控制台错误
2. 使用Lighthouse进行诊断
3. 参考PWA最佳实践文档 