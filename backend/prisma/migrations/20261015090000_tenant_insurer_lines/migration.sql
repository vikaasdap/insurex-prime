-- AlterTable
ALTER TABLE "tenant_insurers" ADD COLUMN "lines" "InsuranceType"[] DEFAULT ARRAY[]::"InsuranceType"[];

-- Existing tenants keep selling every line, exactly as before. Admins can narrow this later.
UPDATE "tenant_insurers"
SET "lines" = ARRAY['LIFE', 'HEALTH', 'MOTOR', 'COMMERCIAL']::"InsuranceType"[];

-- The default stays, so rows inserted by code that does not know about `lines` yet still work
-- (an empty list is read as every line).
ALTER TABLE "tenant_insurers" ALTER COLUMN "lines" SET NOT NULL;
