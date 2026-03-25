// ─────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  view: null,
  params: {},
  activeWorkout: null,
  activeExercises: [],
  loggedSets: {},
  activeBrio: null,
  workoutMsgCount: 0,
  workoutSetCount: 0,
  greetingShown: false,
};

// ─────────────────────────────────────────────
//  Messages
// ─────────────────────────────────────────────
function getProfile() {
  const name = (state.user?.name || '').toLowerCase();
  if (name.includes('gabriel')) return 'gabriel';
  if (name.includes('luana')) return 'luana';
  return 'default';
}

const MSGS = {
  luana: {
    greet: [
      { icon: '🌸💪', text: 'Bora brio, coração!\nHoje você vai arrasar!' },
      { icon: '✨🏋️‍♀️', text: 'A Luana mais dedicada do pedaço chegou! 💕' },
      { icon: '💕🔥', text: 'O Gabriel vai morrer de orgulho de você hoje 😍' },
      { icon: '🌺💪', text: 'Bora, meu bem!\nEsse treino não sabe o que tá vindo 🌸' },
      { icon: '🦋✨', text: 'Hoje é dia de superar a Luana de ontem 💕🔥' },
    ],
    during: [
      { icon: '🌸🔥', text: 'Isso aí, coração!\nTá mandando demais 💪' },
      { icon: '😤💕', text: 'Uiii que poderosa!\nContinua assim, meu bem 🌸' },
      { icon: '💪✨', text: 'Ei, olha o tanto que você evoluiu!\nOrgulho 🥹💕' },
      { icon: '🔥💕', text: 'Mais uma série!\nBora brio, coração! 💪' },
      { icon: '🌺😤', text: 'Ninguém para essa mulher! 🔥\nBora filho do brio!' },
    ],
    finish: [
      { icon: '🎉💕', text: 'Treino concluído!\nVocê é incrível, coração 💪🌸' },
      { icon: '🏆✨', text: 'ISSO! A Luana arrasou hoje!\nGabriel com sorte 😍💕' },
    ],
  },
  gabriel: {
    greet: [
      { icon: '🔥💥', text: 'BORA FILHO DO BRIO, GABRIEL!\nHoje é dia de guerra 💪' },
      { icon: '⚡🦾', text: 'Acorda, campeão!\nO treino não vai se fazer sozinho 🔥' },
      { icon: '💪🔥', text: 'Bora brio, Gab!\nA Luana tá na sua torcida 💕🔥' },
      { icon: '🦾⚡', text: 'GABRIEL EM MODO BRIO TOTAL 🔥\nVAMOS!' },
      { icon: '😤💥', text: 'Hoje tem treino, monstro!\nBORA FILHO DO BRIO 🔥' },
    ],
    during: [
      { icon: '🔥💥', text: 'ISSO AÍ, FILHO DO BRIO! 💪\nNão para agora!' },
      { icon: '🦾⚡', text: 'Mais uma série!\nVocê é um monstro 🔥' },
      { icon: '💕🔥', text: 'A Luana tá orgulhosa de você 💕\nBORA!' },
      { icon: '😤🔥', text: 'BORA BRIO!\nOlha a força desse homem 🦾⚡' },
      { icon: '💥🏆', text: 'Quase lá!\nFilho do brio não desiste 🔥💥' },
    ],
    finish: [
      { icon: '🏆🔥', text: 'TREINO DESTRUÍDO!\nFilho do brio demais 💪🔥' },
      { icon: '💥🦾', text: 'ISSO AÍ GABRIEL!\nA Luana vai surtar de orgulho 😍💕' },
    ],
  },
  default: {
    greet: [{ icon: '💪🔥', text: 'Bora brio!\nHoje é dia de treino 🔥' }],
    during: [{ icon: '🔥💪', text: 'Continua assim!\nBora brio 💪' }],
    finish: [{ icon: '🎉💪', text: 'Treino concluído!\nArrasou 🔥' }],
  },
};

function showCuteMessage(msg) {
  const overlay = document.createElement('div');
  overlay.className = 'cute-message-overlay';
  const box = document.createElement('div');
  box.className = 'cute-message';
  box.innerHTML = `
    <div class="cute-message-icon">${msg.icon}</div>
    <div class="cute-message-text">${msg.text.replace(/\n/g, '<br>')}</div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(box);
  const dismiss = () => { overlay.remove(); box.remove(); };
  overlay.addEventListener('click', dismiss);
  box.addEventListener('click', dismiss);
  setTimeout(dismiss, 4000);
}

function maybeShowGreeting() {
  if (state.greetingShown) return;
  state.greetingShown = true;
  const msgs = MSGS[getProfile()].greet;
  setTimeout(() => showCuteMessage(msgs[Math.floor(Math.random() * msgs.length)]), 700);
}

function maybeShowWorkoutMessage() {
  if (state.workoutMsgCount >= 2) return;
  const msgs = MSGS[getProfile()].during;
  showCuteMessage(msgs[Math.floor(Math.random() * msgs.length)]);
  state.workoutMsgCount++;
}

function setAuth(user, token) {
  state.user = user;
  state.token = token;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// ─────────────────────────────────────────────
//  API
// ─────────────────────────────────────────────
const API_BASE = '/api';

async function apiFetch(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearAuth();
    navigate('auth');
    throw new Error('Session expired');
  }

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const api = {
  register: (name, email, password) => apiFetch('POST', '/auth/register', { name, email, password }),
  login: (email, password) => apiFetch('POST', '/auth/login', { email, password }),

  getTemplates: () => apiFetch('GET', '/templates'),
  getTemplate: (id) => apiFetch('GET', `/templates/${id}`),
  createTemplate: (data) => apiFetch('POST', '/templates', data),
  updateTemplate: (id, data) => apiFetch('PUT', `/templates/${id}`, data),
  deleteTemplate: (id) => apiFetch('DELETE', `/templates/${id}`),
  addExercise: (tId, data) => apiFetch('POST', `/templates/${tId}/exercises`, data),
  updateExercise: (tId, eId, data) => apiFetch('PUT', `/templates/${tId}/exercises/${eId}`, data),
  removeExercise: (tId, eId) => apiFetch('DELETE', `/templates/${tId}/exercises/${eId}`),

  startWorkout: (templateId) => apiFetch('POST', '/workouts/start', { template_id: templateId }),
  getActiveWorkout: () => apiFetch('GET', '/workouts/active'),
  completeWorkout: (id, notes, brio) => apiFetch('PATCH', `/workouts/${id}/complete`, { notes, brio }),
  addLog: (workoutId, data) => apiFetch('POST', `/workouts/${workoutId}/logs`, data),
  deleteLog: (workoutId, logId) => apiFetch('DELETE', `/workouts/${workoutId}/logs/${logId}`),
  getWorkouts: () => apiFetch('GET', '/workouts'),
  getWorkout: (id) => apiFetch('GET', `/workouts/${id}`),
  deleteWorkout: (id) => apiFetch('DELETE', `/workouts/${id}`),
};

// ─────────────────────────────────────────────
//  Router
// ─────────────────────────────────────────────
function navigate(view, params = {}) {
  state.view = view;
  state.params = params;
  render();
}

function render() {
  const app = document.getElementById('app');
  if (!state.token) {
    app.innerHTML = renderAuth();
    bindAuth();
    return;
  }
  app.innerHTML = '<div class="loading-page"><div class="spinner"></div></div>';
  const viewFns = {
    dashboard: renderDashboard,
    templates: renderTemplates,
    'template-detail': () => renderTemplateDetail(state.params.id),
    workout: () => renderActiveWorkout(),
    history: renderHistory,
    'workout-detail': () => renderWorkoutDetail(state.params.id),
  };
  const fn = viewFns[state.view] || renderDashboard;
  fn().then(html => {
    app.innerHTML = html;
    bindNav();
    bindCurrentView();
  }).catch(err => {
    app.innerHTML = renderError(err.message);
  });
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(start, end) {
  if (!start || !end) return '';
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.cssText = `
    position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:999;
    background:${type === 'error' ? '#ef4444' : '#22c55e'};color:#fff;
    padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;
    box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:320px;text-align:center;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

function renderError(msg) {
  return `
    <div class="page">
      <div class="page-content">
        <div class="alert alert-error">${esc(msg)}</div>
        <button class="btn btn-primary" onclick="navigate('dashboard')">Go Home</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
//  Bottom Nav
// ─────────────────────────────────────────────
function navHtml(activeView) {
  const items = [
    { view: 'dashboard', icon: '🏠', label: 'Home' },
    { view: 'templates', icon: '📋', label: 'Templates' },
    { view: 'history', icon: '📖', label: 'History' },
  ];
  return `
    <nav class="bottom-nav">
      ${items.map(i => `
        <button class="nav-item ${activeView === i.view ? 'active' : ''}" data-nav="${i.view}">
          <span class="nav-icon">${i.icon}</span>
          <span>${i.label}</span>
        </button>
      `).join('')}
    </nav>`;
}

function bindNav() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });
}

// ─────────────────────────────────────────────
//  Auth View
// ─────────────────────────────────────────────
function renderAuth() {
  return `
    <div class="auth-page">
      <div class="auth-logo">💪</div>
      <div class="auth-title">Workout Tracker</div>
      <p class="auth-subtitle">Track your gains together</p>
      <div class="auth-card">
        <div class="auth-tabs">
          <div class="auth-tab active" id="tab-login" onclick="switchTab('login')">Login</div>
          <div class="auth-tab" id="tab-register" onclick="switchTab('register')">Register</div>
        </div>
        <div id="auth-error" style="display:none" class="alert alert-error mb-3"></div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" name="email" placeholder="you@email.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" name="password" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="login-btn">Sign In</button>
        </form>

        <form id="register-form" style="display:none">
          <div class="form-group">
            <label class="form-label">Your Name</label>
            <input class="form-input" type="text" name="name" placeholder="Alex" required autocomplete="name" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" name="email" placeholder="you@email.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" name="password" placeholder="Min 6 characters" required autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="register-btn">Create Account</button>
        </form>
      </div>
    </div>`;
}

function switchTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('login-form').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('auth-error').style.display = 'none';
}

function bindAuth() {
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    const err = document.getElementById('auth-error');
    err.style.display = 'none';
    try {
      const data = e.target;
      const result = await api.login(data.email.value, data.password.value);
      setAuth(result.user, result.token);
      navigate('dashboard');
    } catch (ex) {
      err.textContent = ex.message;
      err.style.display = '';
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    btn.disabled = true; btn.textContent = 'Creating account…';
    const err = document.getElementById('auth-error');
    err.style.display = 'none';
    try {
      const data = e.target;
      const result = await api.register(data.name.value, data.email.value, data.password.value);
      setAuth(result.user, result.token);
      navigate('dashboard');
    } catch (ex) {
      err.textContent = ex.message;
      err.style.display = '';
      btn.disabled = false; btn.textContent = 'Create Account';
    }
  });
}

// ─────────────────────────────────────────────
//  Dashboard View
// ─────────────────────────────────────────────
async function renderDashboard() {
  maybeShowGreeting();
  const [templates, workouts, activeWorkout] = await Promise.all([
    api.getTemplates().catch(() => []),
    api.getWorkouts().catch(() => []),
    api.getActiveWorkout().catch(() => null),
  ]);

  const recentWorkouts = workouts.slice(0, 3);

  const activeBanner = activeWorkout ? `
    <div class="active-banner" data-action="resume-workout">
      <div>
        <div class="active-banner-text">⚡ Workout in progress</div>
        <div class="active-banner-sub">${esc(activeWorkout.template_name)} · Tap to resume</div>
      </div>
      <span style="font-size:20px;">→</span>
    </div>` : '';

  const templateCards = templates.length === 0 ? `
    <p class="text-muted text-sm">No templates yet. Create your first one!</p>` :
    templates.slice(0, 4).map(t => `
      <div class="template-item" style="cursor:pointer" data-action="start-workout" data-id="${t.id}">
        <div class="template-icon">🏋️</div>
        <div class="template-info">
          <div class="template-name">${esc(t.name)}</div>
          <div class="template-meta">${t.exercise_count} exercise${t.exercise_count !== 1 ? 's' : ''}</div>
        </div>
        <span style="color:var(--text-light);font-size:18px;">▶</span>
      </div>`).join('');

  const recentHtml = recentWorkouts.length === 0 ? `
    <p class="text-muted text-sm">No workouts yet. Start one!</p>` :
    recentWorkouts.map(w => {
      const d = new Date(w.completed_at);
      return `
        <div class="history-item" style="cursor:pointer" data-action="view-workout" data-id="${w.id}">
          <div class="history-date-badge">
            <div class="history-date-day">${d.getDate()}</div>
            <div class="history-date-month">${d.toLocaleString('en', { month: 'short' })}</div>
          </div>
          <div class="history-info">
            <div class="history-name">${esc(w.template_name)}</div>
            <div class="history-meta">${w.exercise_count} exercises · ${w.total_sets} sets · ${formatDuration(w.started_at, w.completed_at)}</div>
          </div>
        </div>`;
    }).join('');

  const heroChar = getProfile() === 'gabriel' ? '🏋️‍♂️🔥' : getProfile() === 'luana' ? '🏋️‍♀️💕' : '🏋️💪';

  return `
    <div class="page">
      <div class="page-header">
        <span style="font-size:22px;">💪</span>
        <h1>Oi, ${esc(state.user.name)}! ✨</h1>
        <button class="btn btn-ghost btn-sm" data-action="logout">Sair</button>
      </div>
      <div class="page-content">
        <div class="dashboard-hero">
          <div class="dashboard-hero-chars">${heroChar}</div>
          <div class="dashboard-hero-text">Bora brio hoje? 🔥</div>
          <div class="dashboard-hero-sub">Selecione um template abaixo para começar</div>
        </div>
        ${activeBanner}
        <div class="section-title">Começar Treino</div>
        <div class="card">${templateCards}</div>
        ${templates.length > 4 ? `<button class="btn btn-ghost btn-sm mt-2" data-nav="templates">Ver todos →</button>` : ''}

        <div class="section-title" style="margin-top:24px">Histórico Recente</div>
        <div class="card">${recentHtml}</div>
        ${workouts.length > 3 ? `<button class="btn btn-ghost btn-sm mt-2" data-nav="history">Ver tudo →</button>` : ''}
      </div>
      ${navHtml('dashboard')}
    </div>`;
}

// ─────────────────────────────────────────────
//  Templates View
// ─────────────────────────────────────────────
async function renderTemplates() {
  const templates = await api.getTemplates();

  const list = templates.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No templates yet</div>
      <p class="empty-text">Create your first workout template to get started.</p>
    </div>` :
    templates.map(t => `
      <div class="template-item">
        <div class="template-icon" style="cursor:pointer" data-action="view-template" data-id="${t.id}">🏋️</div>
        <div class="template-info" style="cursor:pointer" data-action="view-template" data-id="${t.id}">
          <div class="template-name">${esc(t.name)}</div>
          <div class="template-meta">${t.exercise_count} exercise${t.exercise_count !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-primary btn-sm" data-action="start-workout" data-id="${t.id}">▶ Start</button>
        <button class="btn btn-ghost btn-icon" data-action="delete-template" data-id="${t.id}" title="Delete">🗑</button>
      </div>`).join('');

  return `
    <div class="page">
      <div class="page-header">
        <h1>Templates</h1>
        <button class="btn btn-primary btn-sm" data-action="new-template">+ New</button>
      </div>
      <div class="page-content">
        <div class="card">${list}</div>
      </div>
      ${navHtml('templates')}
    </div>`;
}

// ─────────────────────────────────────────────
//  Template Detail View
// ─────────────────────────────────────────────
async function renderTemplateDetail(id) {
  const template = await api.getTemplate(id);

  const exercises = template.exercises.length === 0 ? `
    <div class="empty-state" style="padding:24px">
      <div class="empty-title">No exercises yet</div>
      <p class="empty-text">Add exercises to this template.</p>
    </div>` :
    template.exercises.map((e, i) => `
      <div class="card-row" style="cursor:default">
        <span style="font-size:18px;min-width:28px;text-align:center;color:var(--text-muted)">${i + 1}</span>
        <div style="flex:1">
          <div style="font-weight:600">${esc(e.name)}</div>
          <div class="text-sm text-muted">${e.default_sets} sets</div>
        </div>
        <button class="btn btn-ghost btn-icon" data-action="delete-exercise" data-exercise-id="${e.id}" data-template-id="${template.id}">🗑</button>
      </div>`).join('');

  return `
    <div class="page">
      <div class="page-header">
        <button class="btn btn-ghost btn-icon" data-action="back">←</button>
        <h1>${esc(template.name)}</h1>
        <button class="btn btn-primary btn-sm" data-action="start-workout" data-id="${template.id}">▶ Start</button>
      </div>
      <div class="page-content">
        ${template.description ? `<p class="text-muted text-sm" style="margin-bottom:12px">${esc(template.description)}</p>` : ''}
        <div class="section-title">Exercises</div>
        <div class="card">${exercises}</div>
        <button class="btn btn-outline mt-3" style="width:100%" data-action="add-exercise" data-template-id="${template.id}">
          + Add Exercise
        </button>
      </div>
      ${navHtml('templates')}
    </div>`;
}

// ─────────────────────────────────────────────
//  Active Workout View
// ─────────────────────────────────────────────
async function renderActiveWorkout() {
  // If we have active workout in state, use it; otherwise check server
  let workout = state.activeWorkout;
  let exercises = state.activeExercises;

  if (!workout) {
    const active = await api.getActiveWorkout();
    if (!active) {
      navigate('dashboard');
      return '<div></div>';
    }
    // Rebuild exercises from template (no prefill history on resume — that's fine)
    let templateExercises = [];
    if (active.template_id) {
      try {
        const tmpl = await api.getTemplate(active.template_id);
        templateExercises = tmpl.exercises.map(ex => ({ ...ex, last_sets: [] }));
      } catch (_) {}
    }

    state.activeWorkout = active;
    state.activeExercises = templateExercises;

    // Rebuild which sets are already logged
    state.loggedSets = {};
    if (active.logs) {
      for (const log of active.logs) {
        state.loggedSets[`${log.exercise_name}:${log.set_number}`] = log.id;
      }
    }

    workout = state.activeWorkout;
    exercises = state.activeExercises;
  }

  // Reset workout message counter and apply brio body class
  state.workoutMsgCount = 0;
  state.workoutSetCount = 0;
  document.body.classList.remove('mode-brio', 'mode-sem-brio');
  if (state.activeBrio === 'com_brio') document.body.classList.add('mode-brio');
  if (state.activeBrio === 'sem_brio') document.body.classList.add('mode-sem-brio');

  const brioSelected = state.activeBrio;
  const brioSelector = `
    <div class="brio-selector">
      <button class="brio-btn ${brioSelected === 'com_brio' ? 'selected-brio' : ''}"
        data-action="select-brio" data-brio="com_brio">
        🔥 Com Brio
      </button>
      <button class="brio-btn ${brioSelected === 'sem_brio' ? 'selected-sem-brio' : ''}"
        data-action="select-brio" data-brio="sem_brio">
        💕 Sem Brio
      </button>
    </div>`;

  const exerciseCards = exercises.map(ex => renderExerciseCard(ex, workout.id)).join('');

  // Build last workout summary from last_sets data
  const lastWorkoutDate = exercises.find(ex => ex.last_sets?.length > 0)?.last_sets?.[0]?.workout_date;
  const lastWorkoutSummary = lastWorkoutDate ? `
    <div style="background:var(--primary-light);border:1px solid #bfdbfe;border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:16px;font-size:13px;">
      <div style="font-weight:700;color:var(--primary);margin-bottom:6px;">📊 Último treino — ${formatDate(lastWorkoutDate)}</div>
      ${exercises.filter(ex => ex.last_sets?.length > 0).map(ex => `
        <div style="margin-bottom:3px;color:var(--text);">
          <strong>${esc(ex.name)}:</strong>
          ${ex.last_sets.map(s => `${s.weight}kg × ${s.reps}`).join(' · ')}
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="page">
      <div class="page-header">
        <h1>🏋️ ${esc(workout.template_name)}</h1>
        <span class="text-muted text-sm">${formatDate(workout.started_at)}</span>
      </div>
      <div class="page-content" id="workout-exercises">
        ${brioSelector}
        ${lastWorkoutSummary}
        <div style="margin-bottom:16px;">
          <textarea id="workout-notes" class="form-textarea"
            placeholder="Observação: como você está hoje? Ex: fadigada, descansada, menstruada..."
            style="min-height:56px;font-size:14px;"></textarea>
        </div>
        ${exerciseCards}
      </div>
      <div class="finish-bar">
        <button class="btn btn-ghost" style="flex:0 0 auto" data-action="discard-workout">Descartar</button>
        <button class="btn btn-success btn-lg" style="flex:1" data-action="finish-workout">Finalizar Treino</button>
      </div>
      ${navHtml('workout')}
    </div>`;
}

function renderExerciseCard(exercise, workoutId) {
  const lastSets = exercise.last_sets || [];
  const numSets = exercise.default_sets || 3;

  const headerRow = `
    <tr>
      <th>Set</th>
      <th>Anterior</th>
      <th>kg</th>
      <th>Reps</th>
      <th></th>
    </tr>`;

  let setRows = '';
  for (let i = 1; i <= numSets; i++) {
    setRows += renderSetRow(exercise, workoutId, i, lastSets);
  }

  const prevSummary = lastSets.length > 0
    ? `Anterior: ${lastSets[0].weight}kg × ${lastSets[0].reps} reps${lastSets.length > 1 ? ` · ${lastSets.length} séries` : ''}`
    : 'Sem dados anteriores';

  return `
    <div class="exercise-card" id="exercise-${cssId(exercise.name)}">
      <div class="exercise-header">
        <div>
          <div class="exercise-name">${esc(exercise.name)}</div>
          <div class="exercise-prev">${prevSummary}</div>
        </div>
      </div>
      <table class="sets-table">
        <thead>${headerRow}</thead>
        <tbody id="sets-${cssId(exercise.name)}">
          ${setRows}
        </tbody>
      </table>
      <table style="width:100%"><tbody>
        <tr class="add-set-row">
          <td>
            <button class="btn btn-ghost btn-sm" data-action="add-set"
              data-exercise="${esc(exercise.name)}" data-workout="${workoutId}">
              + Add Set
            </button>
          </td>
        </tr>
      </tbody></table>
    </div>`;
}

function renderSetRow(exercise, workoutId, setNum, lastSets) {
  const last = lastSets.find(s => s.set_number === setNum);
  const key = `${exercise.name}:${setNum}`;
  const isDone = key in state.loggedSets;

  const prevText = last ? `${last.weight}×${last.reps}` : '—';
  const prefillWeight = last ? last.weight : '';
  const prefillReps = last ? last.reps : '';

  return `
    <tr class="set-row${isDone ? ' done-row' : ''}" id="set-row-${cssId(exercise.name)}-${setNum}">
      <td>${setNum}</td>
      <td class="set-prev">${prevText}</td>
      <td>
        <input class="set-input${prefillWeight && !isDone ? ' prefilled' : ''}" type="number"
          inputmode="decimal" step="0.5" min="0" placeholder="—"
          value="${isDone ? (last ? last.weight : '') : prefillWeight}"
          id="w-${cssId(exercise.name)}-${setNum}"
          data-autolog data-exercise="${esc(exercise.name)}" data-set="${setNum}" data-workout="${workoutId}"
          ${isDone ? 'disabled' : ''} />
      </td>
      <td>
        <input class="set-input${prefillReps && !isDone ? ' prefilled' : ''}" type="number"
          inputmode="numeric" min="0" placeholder="—"
          value="${isDone ? (last ? last.reps : '') : prefillReps}"
          id="r-${cssId(exercise.name)}-${setNum}"
          data-autolog data-exercise="${esc(exercise.name)}" data-set="${setNum}" data-workout="${workoutId}"
          ${isDone ? 'disabled' : ''} />
      </td>
      <td>
        <span id="done-${cssId(exercise.name)}-${setNum}"
          style="font-size:18px;display:block;text-align:center;color:${isDone ? 'var(--success)' : 'var(--border)'}">
          ${isDone ? '✓' : '○'}
        </span>
      </td>
    </tr>`;
}

function cssId(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

// ─────────────────────────────────────────────
//  History View
// ─────────────────────────────────────────────
async function renderHistory() {
  const workouts = await api.getWorkouts();

  const list = workouts.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">📖</div>
      <div class="empty-title">No workouts yet</div>
      <p class="empty-text">Complete your first workout to see history here.</p>
    </div>` :
    workouts.map(w => {
      const d = new Date(w.completed_at);
      return `
        <div class="history-item" style="cursor:pointer" data-action="view-workout" data-id="${w.id}">
          <div class="history-date-badge">
            <div class="history-date-day">${d.getDate()}</div>
            <div class="history-date-month">${d.toLocaleString('en', { month: 'short' })}</div>
          </div>
          <div class="history-info">
            <div class="history-name">${esc(w.template_name)}</div>
            <div class="history-meta">${w.exercise_count} exercícios · ${w.total_sets} séries · ${formatDuration(w.started_at, w.completed_at)}</div>
            ${w.brio ? `<span class="badge ${w.brio === 'com_brio' ? 'badge-brio' : 'badge-sem-brio'}" style="margin-top:4px;display:inline-block">${w.brio === 'com_brio' ? '🔥 Com Brio' : '💕 Sem Brio'}</span>` : ''}
          </div>
          <span style="color:var(--text-light);font-size:16px">›</span>
        </div>`;
    }).join('');

  return `
    <div class="page">
      <div class="page-header">
        <h1>Workout History</h1>
      </div>
      <div class="page-content">
        <div class="card">${list}</div>
      </div>
      ${navHtml('history')}
    </div>`;
}

// ─────────────────────────────────────────────
//  Workout Detail View
// ─────────────────────────────────────────────
async function renderWorkoutDetail(id) {
  const workout = await api.getWorkout(id);

  const duration = formatDuration(workout.started_at, workout.completed_at);

  const exercisesHtml = workout.exercises.map(ex => `
    <div class="workout-exercise-block">
      <div class="workout-exercise-title">${esc(ex.exercise_name)}</div>
      ${ex.sets.map(s => `
        <div class="set-summary-row">
          <span class="set-num">Set ${s.set_number}</span>
          <span><strong>${s.weight ?? '—'}</strong> kg</span>
          <span>×</span>
          <span><strong>${s.reps ?? '—'}</strong> reps</span>
          ${s.notes ? `<span class="text-muted text-sm">· ${esc(s.notes)}</span>` : ''}
        </div>`).join('')}
    </div>`).join('');

  return `
    <div class="page">
      <div class="page-header">
        <button class="btn btn-ghost btn-icon" data-action="back">←</button>
        <h1>${esc(workout.template_name)}</h1>
        <button class="btn btn-ghost btn-icon" data-action="delete-workout" data-id="${workout.id}" title="Delete">🗑</button>
      </div>
      <div class="page-content">
        <div class="flex gap-2 items-center" style="margin-bottom:16px;flex-wrap:wrap;">
          <span class="badge badge-gray">📅 ${formatDate(workout.completed_at)}</span>
          ${duration ? `<span class="badge badge-gray">⏱ ${duration}</span>` : ''}
          <span class="badge badge-success">✓ ${workout.exercises.length} exercises</span>
        </div>
        ${workout.notes ? `<div class="alert alert-info" style="margin-bottom:16px">${esc(workout.notes)}</div>` : ''}
        <div class="card card-body">
          ${exercisesHtml || '<p class="text-muted">No exercises logged.</p>'}
        </div>
      </div>
      ${navHtml('history')}
    </div>`;
}

// ─────────────────────────────────────────────
//  Event Bindings per view
// ─────────────────────────────────────────────
function bindCurrentView() {
  document.addEventListener('click', handleClick, { once: true });
  document.addEventListener('click', handleClick);
}

// Single delegated handler — binds once
const _bound = new WeakSet();
function bindCurrentView() {
  if (_bound.has(document)) return;
  _bound.add(document);
  document.addEventListener('click', handleClick);
  document.addEventListener('focusout', handleFocusOut);
}

// Auto-log a set when user fills both weight and reps
async function handleFocusOut(e) {
  const input = e.target.closest('[data-autolog]');
  if (!input) return;

  const exerciseName = input.dataset.exercise;
  const setNum = parseInt(input.dataset.set);
  const workoutId = input.dataset.workout;
  const key = `${exerciseName}:${setNum}`;

  if (state.loggedSets[key]) return; // already logged

  const weightInput = document.getElementById(`w-${cssId(exerciseName)}-${setNum}`);
  const repsInput = document.getElementById(`r-${cssId(exerciseName)}-${setNum}`);

  const weight = parseFloat(weightInput?.value);
  const reps = parseInt(repsInput?.value);

  if (!weight || !reps) return; // ambos precisam estar preenchidos

  try {
    await api.addLog(workoutId, { exercise_name: exerciseName, set_number: setNum, weight, reps });
    state.loggedSets[key] = true;
    state.workoutSetCount++;
    markSetDone(exerciseName, setNum);
    // Show motivational message at 3rd and 7th set
    if (state.workoutSetCount === 3 || state.workoutSetCount === 7) {
      setTimeout(maybeShowWorkoutMessage, 400);
    }
  } catch (ex) {
    showToast(ex.message, 'error');
  }
}

function markSetDone(exerciseName, setNum) {
  const row = document.getElementById(`set-row-${cssId(exerciseName)}-${setNum}`);
  if (row) row.classList.add('done-row');
  const w = document.getElementById(`w-${cssId(exerciseName)}-${setNum}`);
  const r = document.getElementById(`r-${cssId(exerciseName)}-${setNum}`);
  const indicator = document.getElementById(`done-${cssId(exerciseName)}-${setNum}`);
  if (w) w.disabled = true;
  if (r) r.disabled = true;
  if (indicator) { indicator.textContent = '✓'; indicator.style.color = 'var(--success)'; }
}

async function handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'logout') {
    clearAuth();
    navigate('auth');
    return;
  }

  if (action === 'back') {
    history.back ? history.back() : navigate('dashboard');
    return;
  }

  if (action === 'start-workout') {
    const id = btn.dataset.id;
    btn.disabled = true; btn.textContent = '…';
    try {
      const result = await api.startWorkout(id);
      state.activeWorkout = result.workout;
      state.activeExercises = result.exercises;
      state.loggedSets = {};
      navigate('workout');
    } catch (ex) {
      showToast(ex.message, 'error');
      btn.disabled = false; btn.textContent = '▶ Start';
    }
    return;
  }

  if (action === 'resume-workout') {
    navigate('workout');
    return;
  }

  if (action === 'select-brio') {
    const brio = btn.dataset.brio;
    state.activeBrio = brio;
    document.body.classList.remove('mode-brio', 'mode-sem-brio');
    if (brio === 'com_brio') document.body.classList.add('mode-brio');
    if (brio === 'sem_brio') document.body.classList.add('mode-sem-brio');
    // Update button styles
    document.querySelectorAll('.brio-btn').forEach(b => {
      b.classList.remove('selected-brio', 'selected-sem-brio');
    });
    btn.classList.add(brio === 'com_brio' ? 'selected-brio' : 'selected-sem-brio');
    return;
  }

  if (action === 'new-template') {
    showNewTemplateModal();
    return;
  }

  if (action === 'view-template') {
    navigate('template-detail', { id: btn.dataset.id });
    return;
  }

  if (action === 'delete-template') {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      await api.deleteTemplate(btn.dataset.id);
      showToast('Template deleted');
      navigate('templates');
    } catch (ex) {
      showToast(ex.message, 'error');
    }
    return;
  }

  if (action === 'add-exercise') {
    showAddExerciseModal(btn.dataset.templateId);
    return;
  }

  if (action === 'delete-exercise') {
    if (!confirm('Remove this exercise?')) return;
    try {
      await api.removeExercise(btn.dataset.templateId, btn.dataset.exerciseId);
      showToast('Exercise removed');
      navigate('template-detail', { id: btn.dataset.templateId });
    } catch (ex) {
      showToast(ex.message, 'error');
    }
    return;
  }


  if (action === 'add-set') {
    const exerciseName = btn.dataset.exercise;
    const workoutId = btn.dataset.workout;
    const tbody = document.getElementById(`sets-${cssId(exerciseName)}`);
    if (!tbody) return;

    const existingRows = tbody.querySelectorAll('.set-row').length;
    const newSetNum = existingRows + 1;

    const exercise = state.activeExercises.find(e => e.name === exerciseName) || { name: exerciseName, last_sets: [] };
    const newRow = document.createElement('tr');
    newRow.outerHTML; // won't work — use insertAdjacentHTML
    const tempDiv = document.createElement('tbody');
    tempDiv.innerHTML = renderSetRow(exercise, workoutId, newSetNum, exercise.last_sets || []);
    tbody.appendChild(tempDiv.firstElementChild);
    return;
  }

  if (action === 'finish-workout') {
    const loggedCount = Object.keys(state.loggedSets).length;
    if (loggedCount === 0) {
      if (!confirm('Nenhuma série registrada ainda. Finalizar mesmo assim?')) return;
    }
    const notes = document.getElementById('workout-notes')?.value?.trim() || null;
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    try {
      await api.completeWorkout(state.activeWorkout.id, notes, state.activeBrio);
      const finishMsgs = MSGS[getProfile()].finish;
      const finishMsg = finishMsgs[Math.floor(Math.random() * finishMsgs.length)];
      state.activeWorkout = null;
      state.activeExercises = [];
      state.loggedSets = {};
      state.activeBrio = null;
      document.body.classList.remove('mode-brio', 'mode-sem-brio');
      showCuteMessage(finishMsg);
      setTimeout(() => navigate('history'), 2000);
    } catch (ex) {
      showToast(ex.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Finalizar Treino';
    }
    return;
  }

  if (action === 'discard-workout') {
    if (!confirm('Descartar este treino? Todas as séries registradas serão apagadas.')) return;
    try {
      await api.deleteWorkout(state.activeWorkout.id);
      state.activeWorkout = null;
      state.activeExercises = [];
      state.loggedSets = {};
      state.activeBrio = null;
      document.body.classList.remove('mode-brio', 'mode-sem-brio');
      navigate('dashboard');
    } catch (ex) {
      showToast(ex.message, 'error');
    }
    return;
  }

  if (action === 'view-workout') {
    navigate('workout-detail', { id: btn.dataset.id });
    return;
  }

  if (action === 'delete-workout') {
    if (!confirm('Delete this workout record?')) return;
    try {
      await api.deleteWorkout(btn.dataset.id);
      showToast('Workout deleted');
      navigate('history');
    } catch (ex) {
      showToast(ex.message, 'error');
    }
    return;
  }
}

// ─────────────────────────────────────────────
//  Modals
// ─────────────────────────────────────────────
function showNewTemplateModal() {
  const overlay = showModal(`
    <div class="modal-title">New Template</div>
    <form id="new-template-form">
      <div class="form-group">
        <label class="form-label">Template Name</label>
        <input class="form-input" name="name" placeholder="e.g. Workout A – Chest" required autofocus />
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input class="form-input" name="description" placeholder="Push day, upper body…" />
      </div>
      <button type="submit" class="btn btn-primary btn-lg">Create Template</button>
    </form>`);

  overlay.querySelector('#new-template-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const template = await api.createTemplate({
        name: e.target.name.value,
        description: e.target.description.value,
      });
      overlay.remove();
      navigate('template-detail', { id: template.id });
    } catch (ex) {
      showToast(ex.message, 'error');
      btn.disabled = false; btn.textContent = 'Create Template';
    }
  });
}

function showAddExerciseModal(templateId) {
  const overlay = showModal(`
    <div class="modal-title">Add Exercise</div>
    <form id="add-exercise-form">
      <div class="form-group">
        <label class="form-label">Exercise Name</label>
        <input class="form-input" name="name" placeholder="e.g. Bench Press" required autofocus />
      </div>
      <div class="form-group">
        <label class="form-label">Default Sets</label>
        <input class="form-input" name="default_sets" type="number" min="1" max="20" value="3" />
      </div>
      <button type="submit" class="btn btn-primary btn-lg">Add Exercise</button>
    </form>`);

  overlay.querySelector('#add-exercise-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await api.addExercise(templateId, {
        name: e.target.name.value,
        default_sets: parseInt(e.target.default_sets.value) || 3,
      });
      overlay.remove();
      navigate('template-detail', { id: templateId });
    } catch (ex) {
      showToast(ex.message, 'error');
      btn.disabled = false; btn.textContent = 'Add Exercise';
    }
  });
}

// ─────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────
if (state.token) {
  navigate('dashboard');
} else {
  navigate('auth');
}
