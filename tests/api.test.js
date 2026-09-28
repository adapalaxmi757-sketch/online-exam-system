process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const store = require('../src/store');

const exam = {
  title: 'Sample',
  description: 'demo',
  durationMinutes: 10,
  questions: [
    { text: '2 + 2?', options: ['3', '4'], correctIndex: 1 },
    { text: 'Sky colour?', options: ['Blue', 'Green'], correctIndex: 0 },
  ],
};

const auth = (t) => ({ Authorization: 'Bearer ' + t });
const login = async (email, password) =>
  (await request(app).post('/api/auth/login').send({ email, password })).body.token;

beforeEach(() => {
  store.reset();
  store.insert('users', {
    name: 'Admin',
    email: 'admin@test.local',
    role: 'admin',
    passwordHash: bcrypt.hashSync('Password123', 4),
  });
});

test('health endpoint responds', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('protected routes require a token', async () => {
  const res = await request(app).get('/api/exams');
  expect(res.status).toBe(401);
});

test('duplicate registration is rejected', async () => {
  const body = { name: 'S', email: 's@test.local', password: 'Password123' };
  expect((await request(app).post('/api/auth/register').send(body)).status).toBe(201);
  expect((await request(app).post('/api/auth/register').send(body)).status).toBe(409);
});

test('students cannot create exams', async () => {
  const reg = await request(app).post('/api/auth/register').send({ name: 'S', email: 's@test.local', password: 'Password123' });
  const res = await request(app).post('/api/exams').set(auth(reg.body.token)).send(exam);
  expect(res.status).toBe(403);
});

test('admin creates exam, student takes it and is graded', async () => {
  const adminToken = await login('admin@test.local', 'Password123');
  const created = await request(app).post('/api/exams').set(auth(adminToken)).send(exam);
  expect(created.status).toBe(201);

  const reg = await request(app).post('/api/auth/register').send({ name: 'Stu', email: 'stu@test.local', password: 'Password123' });
  const t = reg.body.token;

  const list = await request(app).get('/api/exams').set(auth(t));
  expect(list.body).toHaveLength(1);
  expect(JSON.stringify(list.body)).not.toContain('correctIndex');

  const start = await request(app).post(`/api/exams/${created.body.id}/start`).set(auth(t));
  expect(start.status).toBe(200);
  expect(JSON.stringify(start.body)).not.toContain('correctIndex');

  const sub = await request(app).post(`/api/exams/${created.body.id}/submit`).set(auth(t)).send({ answers: [1, 1] });
  expect(sub.body).toMatchObject({ score: 1, total: 2, late: false });

  const again = await request(app).post(`/api/exams/${created.body.id}/submit`).set(auth(t)).send({ answers: [1, 0] });
  expect(again.status).toBe(409);

  const results = await request(app).get(`/api/exams/${created.body.id}/results`).set(auth(adminToken));
  expect(results.body.results).toHaveLength(1);
  expect(results.body.results[0].score).toBe(1);
});