# 使用官方Node.js 18 LTS镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NPM_CONFIG_PRODUCTION=true

# 安装必要的系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# 复制后端package.json和package-lock.json
COPY backend/package*.json ./

# 安装生产依赖
RUN npm ci --only=production --no-optional && \
    npm cache clean --force

# 复制后端源代码
COPY backend/ ./

# 创建uploads目录
RUN mkdir -p uploads/shipments

# 设置正确的权限
RUN chown -R node:node /app
USER node

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# 启动应用
CMD ["npm", "start"] 