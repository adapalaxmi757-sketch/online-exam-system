const bcrypt = require('bcryptjs');
const store = require('./store');

function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@exam.local').toLowerCase();
  if (store.findOne('users', (u) => u.email === email)) return false;
  store.insert('users', {
    name: process.env.ADMIN_NAME || 'Administrator',
    email,
    role: 'admin',
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin@12345', 10),
  });
  return true;
}

function seedSampleExam() {
  if (store.find('exams').length) return false;
  store.insert('exams', {
    title: 'Cloud Computing Basics',
    description: 'A short sample exam.',
    durationMinutes: 10,
    questions: [
      { text: 'Which service model gives you a ready-to-use application?', options: ['IaaS', 'PaaS', 'SaaS', 'DaaS'], correctIndex: 2 },
      { text: 'What does CI stand for in CI/CD?', options: ['Continuous Integration', 'Cloud Infrastructure', 'Code Inspection', 'Container Image'], correctIndex: 0 },
      { text: 'Which tool packages an app with its dependencies?', options: ['Git', 'Docker', 'Postman', 'Excel'], correctIndex: 1 },
    ],
  });
  return true;
}

if (require.main === module) {
  require('dotenv').config();
  console.log(ensureAdmin() ? 'Admin user created.' : 'Admin already exists.');
  console.log(seedSampleExam() ? 'Sample exam created.' : 'Exams already exist, skipped sample.');
}

module.exports = { ensureAdmin, seedSampleExam };