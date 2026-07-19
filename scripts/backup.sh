#!/bin/bash
# ============================================
# FidesOrigin PostgreSQL 备份脚本
# K3 Audit Fix: GPG encrypted + S3 offsite + SHA256 checksums
# ============================================

set -euo pipefail

# 配置
BACKUP_DIR="/backups"
DB_NAME="${POSTGRES_DB:-fidesorigin}"
DB_USER="${POSTGRES_USER:-fidesorigin}"
DB_HOST="${POSTGRES_HOST:-postgres}"
# [K3-Audit Fix] Retention: 30 days for GDPR, 1 year for financial compliance
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"        # e.g. s3://fidesorigin-backups
S3_REGION="${BACKUP_S3_REGION:-us-east-1}"
GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PLAIN="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_ENCRYPTED="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz.gpg"
CHECKSUM_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of ${DB_NAME}..."

# 1. 创建备份
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" \
    --clean --if-exists \
    --create \
    --verbose \
    > "${BACKUP_PLAIN}"

# 2. 压缩
gzip -f "${BACKUP_PLAIN}"

# 3. 计算 SHA256 校验和
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] SHA256 checksum: $(cat ${CHECKSUM_FILE})"

# 4. GPG 加密 (AES256)
if [ -n "${GPG_PASSPHRASE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Encrypting backup with GPG (AES256)..."
    gpg --batch --yes --passphrase "${GPG_PASSPHRASE}" \
        --symmetric --cipher-algo AES256 \
        --output "${BACKUP_ENCRYPTED}" \
        "${BACKUP_FILE}"
    rm -f "${BACKUP_FILE}"
    FINAL_BACKUP="${BACKUP_ENCRYPTED}"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: GPG_PASSPHRASE not set — backup is NOT encrypted!"
    FINAL_BACKUP="${BACKUP_FILE}"
fi

# 5. 上传到 S3 (SSE-KMS)
if [ -n "${S3_BUCKET}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading to S3 (${S3_BUCKET})..."
    aws s3 cp "${FINAL_BACKUP}" "${S3_BUCKET}/$(basename ${FINAL_BACKUP})" \
        --region "${S3_REGION}" \
        --server-side-encryption aws:kms \
        --sse-kms-key-id "${BACKUP_KMS_KEY_ID:-}"
    aws s3 cp "${CHECKSUM_FILE}" "${S3_BUCKET}/$(basename ${CHECKSUM_FILE})" \
        --region "${S3_REGION}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] S3 upload complete."
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: S3_BUCKET not set — backup is local only."
fi

# 6. 清理旧备份 (本地)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz*" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sha256" -mtime +${RETENTION_DAYS} -delete

# 7. 清理旧 S3 对象 (保留期策略)
if [ -n "${S3_BUCKET}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] S3 lifecycle policy should handle retention."
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ensure S3 bucket has lifecycle rule: delete after ${RETENTION_DAYS} days."
fi

# 8. 验证清单
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current local backups:"
ls -lh "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup job completed successfully."
