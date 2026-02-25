-- Drop secret columns from site_settings (moved to environment variables)
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpHost";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpPort";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpUser";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpPass";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphTenantId";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphClientId";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphClientSecret";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphUserEmail";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "stripeSecretKey";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "stripePublishableKey";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "stripeWebhookSecret";
