const express = require('express');
const path = require('path');

const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, 'build')));

// PWA必需的headers
app.use((req, res, next) => {
  if (req.url.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// SPA路由支持
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 PWA测试服务器运行在 http://localhost:${PORT}`);
  console.log('💡 建议使用Chrome浏览器测试PWA功能');
}); 