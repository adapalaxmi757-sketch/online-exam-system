require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  dataFile: process.env.DATA_FILE || 'data/db.json',
  // Tests run fully in memory
  persist: process.env.NODE_ENV !== 'test',
};