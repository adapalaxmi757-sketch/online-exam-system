(() => {
  const $app = document.getElementById('app');
  const $nav = document.getElementById('nav');
  let timer = null;

  let storedUser = null;
  try { storedUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { /* ignore */ }
  const state = { user: storedUser };

  // ---------- helpers ----------
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'class') e.className = v;
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat()) {
      if (c == null) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  const notice = (msg, type = 'error') => h('p', { class: 'notice ' + type }, msg);
  const fmt = (d) => new Date(d).toLocaleString();

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    state.user = null;
    render();
  }

  function setSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    state.user = data.user;
    render();
  }

  // ---------- auth ----------
  function authView(mode = 'login') {
    const err = h('p', { class: 'notice error' });
    err.hidden = true;
    const name = h('input', { type: 'text', autocomplete: 'name' });
    const email = h('input', { type: 'email', required: '', autocomplete: 'email' });
    const password = h('input', { type: 'password', required: '', minlength: '8', autocomplete: mode === 'login' ? 'current-password' : 'new-password' });

    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        err.hidden = true;
        try {
          const body = { email: email.value, password: password.value };
          if (mode === 'register') body.name = name.value;
          setSession(await api('/auth/' + mode, { method: 'POST', body }));
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
        }
      },
    },
      mode === 'register' ? [h('label', {}, 'Full name'), name] : null,
      h('label', {}, 'Email'), email,
      h('label', {}, 'Password'), password,
      err,
      h('div', { class: 'row' },
        h('button', { type: 'submit' }, mode === 'login' ? 'Log in' : 'Create student account'),
        h('button', { type: 'button', class: 'secondary', onclick: () => authView(mode === 'login' ? 'register' : 'login') },
          mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in')
      )
    );
    $app.replaceChildren(h('div', { class: 'card' }, h('h2', {}, mode === 'login' ? 'Log in' : 'Register'), form));
  }

  // ---------- student ----------
  async function studentView() {
    $app.replaceChildren(h('p', { class: 'muted' }, 'Loading...'));
    const [exams, results] = await Promise.all([api('/exams'), api('/exams/results/me')]);

    const examCards = exams.length
      ? exams.map((ex) => {
          const a = ex.attempt;
          let action;
          if (a && a.status === 'submitted') action = h('strong', {}, `Score: ${a.score}/${a.total}`);
          else action = h('button', { onclick: () => takeExam(ex.id).catch((e) => alert(e.message)) }, a ? 'Resume' : 'Start');
          return h('div', { class: 'card row' },
            h('div', {}, h('h3', {}, ex.title), h('div', { class: 'muted' }, `${ex.description || ''} ${ex.questionCount} questions, ${ex.durationMinutes} min`)),
            action);
        })
      : [h('p', { class: 'muted' }, 'No exams available yet.')];

    const table = results.length
      ? h('table', {},
          h('tr', {}, h('th', {}, 'Exam'), h('th', {}, 'Score'), h('th', {}, 'Submitted')),
          results.map((r) => h('tr', {},
            h('td', {}, r.examTitle),
            h('td', {}, r.late ? `${r.score}/${r.total} (late)` : `${r.score}/${r.total}`),
            h('td', {}, fmt(r.submittedAt)))))
      : h('p', { class: 'muted' }, 'No results yet.');

    $app.replaceChildren(h('h2', {}, 'Available exams'), examCards, h('div', { class: 'card' }, h('h2', {}, 'My results'), table));
  }

  async function takeExam(id) {
    const data = await api(`/exams/${id}/start`, { method: 'POST' });
    const offset = new Date(data.serverTime).getTime() - Date.now();
    const deadline = new Date(data.deadline).getTime();
    const answers = new Array(data.exam.questions.length).fill(null);
    const clock = h('span', { class: 'clock' });
    let done = false;

    const submit = async () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      try {
        const r = await api(`/exams/${id}/submit`, { method: 'POST', body: { answers } });
        showResult(data.exam.title, r);
      } catch (ex) {
        done = false;
        alert(ex.message);
      }
    };

    const tick = () => {
      const remaining = deadline - (Date.now() + offset);
      if (remaining <= 0) { clock.textContent = '00:00'; submit(); return; }
      const s = Math.floor(remaining / 1000);
      clock.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      clock.className = 'clock' + (s < 60 ? ' low' : '');
    };

    const questions = data.exam.questions.map((q, i) =>
      h('fieldset', {},
        h('legend', {}, `${i + 1}. ${q.text}`),
        q.options.map((opt, j) =>
          h('label', { class: 'option' },
            h('input', { type: 'radio', name: 'q' + i, onchange: () => { answers[i] = j; } }),
            opt))));

    $app.replaceChildren(
      h('div', { class: 'card row' }, h('h2', {}, data.exam.title), clock),
      questions,
      h('button', { onclick: () => { if (confirm('Submit your answers?')) submit(); } }, 'Submit exam'));
    clearInterval(timer);
    tick();
    timer = setInterval(tick, 1000);
  }

  function showResult(title, r) {
    $app.replaceChildren(h('div', { class: 'card' },
      h('h2', {}, title),
      h('div', { class: 'score' }, `${r.score} / ${r.total}`),
      r.late ? notice('Submitted after the deadline, so the answers were not graded.') : notice('Exam submitted successfully.', 'ok'),
      h('button', { onclick: render }, 'Back to dashboard')));
  }

  // ---------- admin ----------
  async function adminView() {
    $app.replaceChildren(h('p', { class: 'muted' }, 'Loading...'));
    const exams = await api('/exams');

    // -- create exam form --
    const title = h('input', { type: 'text' });
    const desc = h('input', { type: 'text' });
    const duration = h('input', { type: 'number', min: '1', max: '480', value: '30' });
    const qBox = h('div', {});
    const qs = [];
    const msg = h('div', {});

    function addQuestion() {
      const text = h('input', { type: 'text', placeholder: 'Question text' });
      const opts = [0, 1, 2, 3].map((i) => h('input', { type: 'text', placeholder: `Option ${i + 1}` + (i < 2 ? ' (required)' : '') }));
      const correct = h('select', {}, [0, 1, 2, 3].map((i) => h('option', { value: String(i) }, `Correct: option ${i + 1}`)));
      const block = h('div', { class: 'qbuilder' }, text, opts, correct);
      qs.push({ text, opts, correct });
      qBox.append(block);
    }
    addQuestion();

    async function save() {
      msg.replaceChildren();
      const questions = [];
      for (const [n, q] of qs.entries()) {
        const options = [];
        let correctIndex = -1;
        q.opts.forEach((o, i) => {
          const v = o.value.trim();
          if (!v) return;
          if (i === Number(q.correct.value)) correctIndex = options.length;
          options.push(v);
        });
        if (correctIndex === -1) { msg.append(notice(`Question ${n + 1}: the correct option is empty.`)); return; }
        questions.push({ text: q.text.value, options, correctIndex });
      }
      try {
        await api('/exams', { method: 'POST', body: { title: title.value, description: desc.value, durationMinutes: Number(duration.value), questions } });
        render();
      } catch (ex) {
        msg.append(notice(ex.message));
      }
    }

    const createCard = h('div', { class: 'card' },
      h('h2', {}, 'Create exam'),
      h('label', {}, 'Title'), title,
      h('label', {}, 'Description'), desc,
      h('label', {}, 'Duration (minutes)'), duration,
      h('label', {}, 'Questions'), qBox,
      h('div', { class: 'row' },
        h('button', { class: 'secondary', onclick: addQuestion }, '+ Add question'),
        h('button', { onclick: save }, 'Save exam')),
      msg);

    // -- exam list --
    const resultsPanel = h('div', {});
    const list = exams.length
      ? exams.map((ex) => h('div', { class: 'card row' },
          h('div', {}, h('h3', {}, ex.title), h('div', { class: 'muted' }, `${ex.questionCount} questions, ${ex.durationMinutes} min`)),
          h('div', { class: 'row' },
            h('button', { class: 'secondary', onclick: () => showResults(ex.id) }, 'Results'),
            h('button', { class: 'danger', onclick: async () => {
              if (!confirm(`Delete "${ex.title}" and all its submissions?`)) return;
              await api('/exams/' + ex.id, { method: 'DELETE' });
              render();
            } }, 'Delete'))))
      : [h('p', { class: 'muted' }, 'No exams yet.')];

    async function showResults(id) {
      const data = await api(`/exams/${id}/results`);
      resultsPanel.replaceChildren(h('div', { class: 'card' },
        h('h2', {}, 'Results: ' + data.exam.title),
        data.results.length
          ? h('table', {},
              h('tr', {}, h('th', {}, 'Student'), h('th', {}, 'Score'), h('th', {}, 'Submitted')),
              data.results.map((r) => h('tr', {}, h('td', {}, r.student), h('td', {}, `${r.score}/${r.total}${r.late ? ' (late)' : ''}`), h('td', {}, fmt(r.submittedAt)))))
          : h('p', { class: 'muted' }, 'No submissions yet.')));
    }

    $app.replaceChildren(createCard, h('h2', {}, 'Exams'), list, resultsPanel);
  }

  // ---------- router ----------
  function render() {
    clearInterval(timer);
    $nav.replaceChildren();
    if (!state.user) return authView();
    $nav.append(
      h('span', {}, `${state.user.name} (${state.user.role})`),
      h('button', { class: 'link', onclick: logout }, 'Log out'));
    const view = state.user.role === 'admin' ? adminView() : studentView();
    view.catch((e) => {
      if (e.status === 401) logout();
      else $app.replaceChildren(notice(e.message));
    });
  }

  render();
})();