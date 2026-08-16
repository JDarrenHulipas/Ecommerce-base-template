require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'la-casa-del-cruasan',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminSecret: process.env.ADMIN_SECRET || '',
  adminTokenTtl: Number(process.env.ADMIN_TOKEN_TTL || 24 * 3600),
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'),
  s3Bucket: process.env.S3_BUCKET || '',
  s3Region: process.env.S3_REGION || 'eu-south-2',
  s3Endpoint: process.env.S3_ENDPOINT || '',
};
