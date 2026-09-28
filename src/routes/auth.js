const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('../store');
const config = require('../config');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const sign = (u) =>
  jwt.sign({ sub: u.id, name: u.name, role: u.role }, config.jwtSecret, { expiresIn: '8h' });

// Self-registration always creates a student. Admins are created by the seed script.
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (typeof email !== 'string' || !emailRe.test(email)) return res.status(400).json({ error: 'Valid email is required' });
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const normalized = email.trim().toLowerCase();
  if (store.findOne('users', (u) => u.email === normalized))
    return res.status(409).json({ error: 'Email already registered' });

  const user = store.insert('users', {
    name: name.trim(),
    email: normalized,
    role: 'student',
    passwordHash: bcrypt.hashSync(password, 10),
  });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user =
    typeof email === 'string' && store.findOne('users', (u) => u.email === email.trim().toLowerCase());
  if (!user || typeof password !== 'string' || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  const user = store.findOne('users', (u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(user));
});

module.exports = router;