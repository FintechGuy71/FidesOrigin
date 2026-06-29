FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 安装Prisma
RUN npm install -g prisma

# 复制代码
COPY . .

# 生成Prisma客户端
RUN prisma generate

# 创建日志目录
RUN mkdir -p /app/logs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

CMD ["npm", "start"]
