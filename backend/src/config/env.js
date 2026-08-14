require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'la-casa-del-cruasan',
};
