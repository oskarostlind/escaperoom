ALTER TABLE "teams" ALTER COLUMN "order_ids" TYPE text[] USING "order_ids"::text[];
ALTER TABLE "teams" ALTER COLUMN "order_ids" SET DEFAULT ARRAY[]::TEXT[];
