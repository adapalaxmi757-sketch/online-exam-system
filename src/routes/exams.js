const express = require('express');
const store = require('../store');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const GRACE_MS = 30 * 1000;

// Never leak correct answers to students
const sanitize = (exam) => ({
  id: exam.id,
  title: exam.title,
  description: exam.description,
  durationMinutes: exam.durationMinutes,
  questionCount: exam.questions.length,
  questions: exam.questions.map((q) => ({ text: q.text, options: q.options })),
});

function validateExam(b) {
  if (!b || typeof b.title !== 'string' || !b.title.trim()) return 'Title is required';
  const d = Number(b.durationMinutes);
  if (!Number.isInteger(d) || d < 1 || d > 480) return 'durationMinutes must be an integer between 1 and 480';
  if (!Array.isArray(b.questions) || b.questions.length === 0) return 'At least one question is required';
  for (const [i, q] of b.questions.entries()) {
    const n = i + 1;
    if (!q || typeof q.text !== 'string' || !q.text.trim()) return `Question ${n}: text is required`;
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some((o) => typeof o !== 'string' || !o.trim()))
      return `Question ${n}: needs at least 2 non-empty options`;
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length)
      return `Question ${n}: invalid correct answer`;
  }
  return null;
}

// ---- admin: create / list / delete / results ----
router.post('/', requireRole('admin'), (req, res) => {
  const error = validateExam(req.body);
  if (error) return res.status(400).json({ error });
  const b = req.body;
  const exam = store.insert('exams', {
    title: b.title.trim(),
    description: (b.description || '').toString().trim(),
    durationMinutes: Number(b.durationMinutes),
    questions: b.questions.map((q) => ({
      text: q.text.trim(),
      options: q.options.map((o) => o.trim()),
      correctIndex: q.correctIndex,
    })),
    createdBy: req.user.sub,
  });
  res.status(201).json(exam);
});

router.get('/', (req, res) => {
  const exams = store.find('exams');
  if (req.user.role === 'admin') {
    return res.json(exams.map((e) => ({ ...e, questionCount: e.questions.length })));
  }
  const mine = store.find('submissions', (s) => s.userId === req.user.sub);
  res.json(
    exams.map((e) => {
      const { questions, ...summary } = sanitize(e);
      const a = mine.find((s) => s.examId === e.id);
      return { ...summary, attempt: a ? { status: a.status, score: a.score, total: a.total } : null };
    })
  );
});

// NOTE: must be declared before '/:id'
router.get('/results/me', requireRole('student'), (req, res) => {
  const rows = store
    .find('submissions', (s) => s.userId === req.user.sub && s.status === 'submitted')
    .map((s) => {
      const exam = store.findOne('exams', (e) => e.id === s.examId);
      return {
        examId: s.examId,
        examTitle: exam ? exam.title : '(deleted exam)',
        score: s.score,
        total: s.total,
        late: s.late,
        submittedAt: s.submittedAt,
      };
    });
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const exam = store.findOne('exams', (e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  res.json(req.user.role === 'admin' ? exam : sanitize(exam));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const removed = store.remove('exams', (e) => e.id === req.params.id);
  if (!removed) return res.status(404).json({ error: 'Exam not found' });
  store.remove('submissions', (s) => s.examId === req.params.id);
  res.status(204).end();
});

router.get('/:id/results', requireRole('admin'), (req, res) => {
  const exam = store.findOne('exams', (e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const rows = store
    .find('submissions', (s) => s.examId === exam.id && s.status === 'submitted')
    .map((s) => ({
      student: s.userName,
      score: s.score,
      total: s.total,
      late: s.late,
      submittedAt: s.submittedAt,
    }));
  res.json({ exam: { id: exam.id, title: exam.title }, results: rows });
});

// ---- student: start / submit ----
router.post('/:id/start', requireRole('student'), (req, res) => {
  const exam = store.findOne('exams', (e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  let attempt = store.findOne('submissions', (s) => s.examId === exam.id && s.userId === req.user.sub);
  if (attempt && attempt.status === 'submitted')
    return res.status(409).json({ error: 'You have already submitted this exam' });

  if (!attempt) {
    attempt = store.insert('submissions', {
      examId: exam.id,
      userId: req.user.sub,
      userName: req.user.name,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    });
  }
  const deadline = new Date(new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000);
  res.json({
    exam: sanitize(exam),
    startedAt: attempt.startedAt,
    deadline: deadline.toISOString(),
    serverTime: new Date().toISOString(),
  });
});

router.post('/:id/submit', requireRole('student'), (req, res) => {
  const exam = store.findOne('exams', (e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const attempt = store.findOne('submissions', (s) => s.examId === exam.id && s.userId === req.user.sub);
  if (!attempt) return res.status(400).json({ error: 'Start the exam first' });
  if (attempt.status === 'submitted') return res.status(409).json({ error: 'You have already submitted this exam' });

  const answers = Array.isArray(req.body && req.body.answers) ? req.body.answers : [];
  const deadline = new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000;
  const late = Date.now() > deadline + GRACE_MS;

  let score = 0;
  if (!late) exam.questions.forEach((q, i) => { if (answers[i] === q.correctIndex) score++; });

  store.update('submissions', attempt.id, {
    status: 'submitted',
    answers,
    score,
    total: exam.questions.length,
    late,
    submittedAt: new Date().toISOString(),
  });
  res.json({ score, total: exam.questions.length, late });
});

module.exports = router;