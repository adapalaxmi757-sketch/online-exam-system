const path = require('path');
const express = require('express');
const helmet = require('helmet');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } },
  })
);
app.use(express.json({ limit: '1mb' }));

// Health endpoint for load balancers / container orchestrators
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

module.exports = app;