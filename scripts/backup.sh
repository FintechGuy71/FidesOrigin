#!/bin/bash
# ============================================
# FidesOrigin PostgreSQL 备份脚本
# ============================================

set -e

# 配置
BACKUP_DIR="/backups"
DB_NAME="${POSTGRES_DB:-fidesorigin}"
DB_USER="${POSTGRES_USER:-fidesorigin}"
DB_HOST="${POSTGRES_HOST:-postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of ${DB_NAME}..."

# 创建备份
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" \
    --clean --if-exists \
    --create \
    --verbose \
    | gzip > "${BACKUP_FILE}"

# 检查备份是否成功
if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed: ${BACKUP_FILE}"
    ls -lh "${BACKUP_FILE}"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup failed!"
    exit 1
fi

# 清理旧备份
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# 列出当前备份
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current backups:"
ls -lh "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup job completed."
