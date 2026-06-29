-- CreateTable
CREATE TABLE "risk_addresses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'ethereum',
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "metadata" TEXT,
    "syncedToChain" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "addressesCount" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT
);

-- CreateTable
CREATE TABLE "data_source_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "apiUrl" TEXT,
    "lastSync" DATETIME,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "risk_addresses_address_key" ON "risk_addresses"("address");

-- CreateIndex
CREATE INDEX "risk_addresses_category_idx" ON "risk_addresses"("category");

-- CreateIndex
CREATE INDEX "risk_addresses_syncedToChain_idx" ON "risk_addresses"("syncedToChain");

-- CreateIndex
CREATE INDEX "risk_addresses_riskScore_idx" ON "risk_addresses"("riskScore");

-- CreateIndex
CREATE INDEX "risk_addresses_chain_idx" ON "risk_addresses"("chain");

-- CreateIndex
CREATE INDEX "sync_logs_timestamp_idx" ON "sync_logs"("timestamp");

-- CreateIndex
CREATE INDEX "sync_logs_source_idx" ON "sync_logs"("source");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "data_source_configs_name_key" ON "data_source_configs"("name");
