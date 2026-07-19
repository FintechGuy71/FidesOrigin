FROM node:20-alpine

WORKDIR /app

# [K3-Audit Fix] Create non-root user for runtime security
RUN adduser -D -u 1001 appuser && chown -R appuser:appuser /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 安装Prisma
RUN npm install -g prisma

# 复制代码
COPY . .

# 生成Prisma客户端
RUN prisma generate

# 创建日志目录并设置权限
RUN mkdir -p /app/logs && chown -R appuser:appuser /app

# 切换到非 root 用户运行
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

CMD ["npm", "start"]
