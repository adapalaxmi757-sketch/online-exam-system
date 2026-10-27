const config = require('./config');
const app = require('./app');
const { ensureAdmin } = require('./seed');

if (ensureAdmin()) console.log('Default admin created (see ADMIN_EMAIL / ADMIN_PASSWORD in .env).');

const server = app.listen(config.port, () => {
  console.log(`Exam system running on http://localhost:${config.port}`);
});

// Graceful shutdown (needed for containers)
['SIGINT', 'SIGTERM'].forEach((sig) =>
  process.on(sig, () => {
    console.log(`${sig} received, shutting down...`);
    server.close(() => process.exit(0));
  })
);