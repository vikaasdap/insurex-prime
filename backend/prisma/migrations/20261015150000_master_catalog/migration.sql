-- CreateTable
CREATE TABLE "master_categories" (
    "id" UUID NOT NULL,
    "insurerId" UUID NOT NULL,
    "line" "InsuranceType" NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_policies" (
    "id" UUID NOT NULL,
    "insurerId" UUID NOT NULL,
    "categoryId" UUID,
    "insuranceType" "InsuranceType" NOT NULL,
    "policyCode" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "uin" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "coverageAmount" DECIMAL(14,2),
    "premium" DECIMAL(12,2),
    "durationMonths" INTEGER,
    "benefits" TEXT[],
    "categoryDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_categories_insurerId_line_parentId_idx" ON "master_categories"("insurerId", "line", "parentId");

-- CreateIndex
CREATE INDEX "master_policies_insurerId_insuranceType_idx" ON "master_policies"("insurerId", "insuranceType");

-- CreateIndex
CREATE INDEX "master_policies_categoryId_idx" ON "master_policies"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "master_policies_insurerId_policyCode_key" ON "master_policies"("insurerId", "policyCode");

-- AddForeignKey
ALTER TABLE "master_categories" ADD CONSTRAINT "master_categories_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_categories" ADD CONSTRAINT "master_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "master_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_policies" ADD CONSTRAINT "master_policies_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_policies" ADD CONSTRAINT "master_policies_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "master_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
