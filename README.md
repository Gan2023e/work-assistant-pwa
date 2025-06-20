# 工作助手PWA

一个集成产品管理、物流、备货、工资结算等功能的Progressive Web App（渐进式Web应用）。

## ✨ PWA 特性

- 📱 **可安装**: 可以像原生应用一样安装到设备主屏幕
- 🔄 **离线工作**: 在网络不佳或离线状态下仍可使用基本功能
- ⚡ **快速加载**: 通过缓存机制实现快速启动
- 🔔 **推送通知**: 支持实时通知功能
- 📱 **响应式设计**: 适配各种设备屏幕尺寸
- 🔄 **自动更新**: 检测并提示应用更新

## 🚀 快速开始

### 开发环境启动

```bash
# 安装依赖
npm install

# 启动前端开发服务器
cd frontend
npm start

# 启动后端服务器
cd backend
npm start
```

### 生产环境构建

```bash
# 构建PWA应用
cd frontend
npm run build-pwa

# 启动生产环境服务
npm run serve
```

## 📦 项目结构

```
工作助手PWA/
├── frontend/               # 前端React应用
│   ├── public/
│   │   ├── manifest.json   # PWA应用清单
│   │   ├── sw.js          # Service Worker
│   │   ├── offline.html   # 离线页面
│   │   └── browserconfig.xml # Windows设备配置
│   ├── src/
│   │   ├── components/
│   │   │   └── PWAManager.tsx # PWA管理组件
│   │   ├── pages/         # 页面组件
│   │   └── App.tsx        # 主应用组件
│   └── package.json
├── backend/               # 后端Node.js应用
│   ├── models/           # 数据模型
│   ├── routes/           # API路由
│   └── app.js           # 后端入口
└── package.json
```

## 🔧 PWA 配置说明

### 1. Web App Manifest (`manifest.json`)

配置了应用的基本信息，包括：
- 应用名称和描述
- 图标配置
- 启动URL和显示模式
- 主题颜色和背景色
- 支持的设备方向

### 2. Service Worker (`sw.js`)

实现了以下功能：
- **缓存策略**: 缓存应用资源和API响应
- **离线支持**: 网络断开时提供基本功能
- **后台同步**: 支持后台数据同步
- **推送通知**: 处理推送消息和通知

### 3. PWA管理组件 (`PWAManager.tsx`)

提供以下功能：
- 网络状态监控
- 安装提示管理
- 应用更新通知
- 离线状态处理

## 📱 安装指南

### 在移动设备上安装

1. **Android (Chrome/Edge)**:
   - 访问应用网址
   - 点击浏览器菜单中的"添加到主屏幕"
   - 或点击地址栏的安装图标

2. **iOS (Safari)**:
   - 访问应用网址
   - 点击分享按钮 📤
   - 选择"添加到主屏幕"

### 在桌面上安装

1. **Windows/Mac/Linux (Chrome/Edge)**:
   - 访问应用网址
   - 点击地址栏右侧的安装图标
   - 或使用浏览器菜单中的"安装应用"

## 🔌 离线功能

应用在离线状态下提供以下功能：

- ✅ 浏览已缓存的页面
- ✅ 查看历史数据
- ✅ 使用基本计算功能
- ✅ 页面导航
- ❌ 实时数据同步
- ❌ 新数据提交

## 🔄 更新机制

应用采用以下更新策略：

1. **自动检测**: Service Worker自动检测新版本
2. **用户提示**: 发现更新时显示通知
3. **手动更新**: 用户可选择立即更新或稍后更新
4. **后台更新**: 新版本在后台下载，不影响当前使用

## 📊 性能优化

### 缓存策略

- **应用外壳**: 立即缓存（Cache First）
- **静态资源**: 网络优先，缓存降级（Network First）
- **API数据**: 缓存优先，网络更新（Cache First with Network Update）

### 代码分割

- 页面级别的代码分割
- 组件懒加载
- 资源按需加载

## 🛠️ 开发指南

### 添加新页面

1. 在 `src/pages/` 下创建新的页面组件
2. 在 `App.tsx` 中添加路由配置
3. 更新导航菜单

### 修改PWA配置

1. **应用信息**: 编辑 `public/manifest.json`
2. **缓存策略**: 修改 `public/sw.js`
3. **安装提示**: 调整 `PWAManager.tsx`

### 调试PWA

1. 使用Chrome DevTools的Application面板
2. 检查Service Worker状态
3. 查看缓存内容
4. 模拟离线状态

## 🚀 部署指南

### 部署要求

- ✅ HTTPS协议（必需）
- ✅ 有效的SSL证书
- ✅ 服务器支持Service Worker
- ✅ 正确的MIME类型配置

### 推荐部署平台

- **Netlify**: 零配置PWA部署
- **Vercel**: 优秀的前端托管平台
- **GitHub Pages**: 免费的静态网站托管
- **Firebase Hosting**: Google的全栈平台

### 部署步骤

```bash
# 1. 构建应用
npm run build-pwa

# 2. 测试构建结果
npm run serve

# 3. 部署到生产环境
# (根据选择的平台执行相应的部署命令)
```

## 📱 浏览器支持

| 浏览器 | 版本 | PWA支持 | 安装支持 |
|--------|------|---------|----------|
| Chrome | 67+ | ✅ | ✅ |
| Firefox | 44+ | ✅ | ❌ |
| Safari | 11.1+ | ✅ | ✅ |
| Edge | 17+ | ✅ | ✅ |

## 🐛 故障排除

### 常见问题

1. **Service Worker未注册**
   - 检查HTTPS协议
   - 确认sw.js文件路径
   - 查看浏览器控制台错误

2. **安装提示未显示**
   - 确认满足PWA要求
   - 检查manifest.json配置
   - 验证Service Worker正常工作

3. **离线功能不工作**
   - 检查缓存策略配置
   - 验证资源正确缓存
   - 确认离线页面存在

### 调试工具

- Chrome DevTools Application面板
- Lighthouse PWA审计
- PWA Builder工具

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📞 支持

如果您在使用过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 在GitHub上提交Issue
3. 联系开发团队 