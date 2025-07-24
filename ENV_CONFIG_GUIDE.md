# 环境变量配置指南

## 🌐 云端部署配置

为了更好地支持云端部署，我们提供了灵活的环境变量配置。

### 打印服务配置

#### 创建环境变量文件

在 `frontend` 目录下创建 `.env.local` 文件：

```env
# 打印服务配置
# 云端部署时可以留空（推荐）或设置为您的自定义打印服务地址
REACT_APP_PRINT_SERVICE_URL=

# 如果您有自己的打印服务器，可以设置为具体地址
# REACT_APP_PRINT_SERVICE_URL=https://your-print-service.com:3001

# 调试模式
REACT_APP_DEBUG=false
```

### 配置说明

#### 1. 云端部署（推荐配置）
```env
# 留空，系统自动使用浏览器打印
REACT_APP_PRINT_SERVICE_URL=
```

**效果**：
- ✅ 系统自动检测为云端模式
- ✅ 优先使用浏览器打印
- ✅ 不会尝试连接localhost
- ✅ 用户体验更佳

#### 2. 本地开发
```env
# 使用默认本地地址
REACT_APP_PRINT_SERVICE_URL=http://localhost:3001
```

**效果**：
- 🖥️ 系统检测为本地模式
- 🔧 尝试连接本地打印服务
- 📄 本地服务不可用时回退到浏览器打印

#### 3. 自定义打印服务
```env
# 使用自定义打印服务地址
REACT_APP_PRINT_SERVICE_URL=https://print.yourcompany.com:3001
```

**适用场景**：
- 企业内网部署
- 专用打印服务器
- VPN环境

### 部署平台特定配置

#### Netlify
在 Netlify 控制台的环境变量中设置：
```
REACT_APP_PRINT_SERVICE_URL = (留空)
```

#### Vercel
在 `vercel.json` 或控制台中设置：
```json
{
  "env": {
    "REACT_APP_PRINT_SERVICE_URL": ""
  }
}
```

#### Railway
在 Railway 控制台的变量设置中：
```
REACT_APP_PRINT_SERVICE_URL = 
```

#### Docker 部署
在 `docker-compose.yml` 中：
```yaml
environment:
  - REACT_APP_PRINT_SERVICE_URL=
```

### 验证配置

配置完成后，访问应用：

1. **打开首页**：查看打印服务状态指示器
2. **点击打印设置**：查看部署模式显示
3. **测试打印**：确认打印功能正常

### 状态显示

配置正确后，您会看到：

- **云端模式**: `云端模式 - 打印服务: 离线 (浏览器打印模式)`
- **本地模式**: `本地模式 - 打印服务: 在线 (http://localhost:3001)`

### 常见问题

#### Q: 设置了环境变量但没有生效？
A: 
1. 确认文件名为 `.env.local`
2. 重启开发服务器 `npm start`
3. 检查变量名拼写是否正确

#### Q: 云端部署时还是显示localhost？
A: 
1. 确认已设置 `REACT_APP_PRINT_SERVICE_URL=`（空值）
2. 确认部署平台的环境变量配置正确
3. 重新部署应用

#### Q: 想要完全禁用本地打印功能？
A: 
设置 `REACT_APP_PRINT_SERVICE_URL=` 为空值即可

### 最佳实践

1. **云端部署**：始终设置为空值
2. **本地开发**：使用默认配置或明确设置
3. **企业部署**：根据网络环境配置专用地址
4. **测试环境**：可以设置为测试服务器地址

---

**推荐配置**：对于云端部署，不设置 `REACT_APP_PRINT_SERVICE_URL` 或设置为空值，让系统自动使用最佳的打印方案。 