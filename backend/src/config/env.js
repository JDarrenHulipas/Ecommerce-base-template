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
};
