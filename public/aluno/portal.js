/**
 * Links Hub — Portal do Aluno (Standalone JS)
 * Página independente com login, cadastro, dashboard, calendário e agendamento.
 */

// ==========================================
// ESTADO GLOBAL
// ==========================================
let currentStudent = null;  // { id, nome, email, telefone, cpf }
let currentProfessor = null; // { id, nome, slug } — resolvido pelo slug da URL
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = formatDateISO(new Date());
let allAgendamentos = [];

const API = '/api';

// Extrai o slug do professor da URL: /aluno/:slug
const pathParts = window.location.pathname.split('/').filter(Boolean);
const professorSlug = pathParts.length >= 2 ? pathParts[1] : null;

// ==========================================
// ELEMENTOS DOM
// ==========================================
const authScreen = document.getElementById('auth-screen');
const portalScreen = document.getElementById('portal-screen');

// Auth
const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');
const authFooterText = document.getElementById('auth-footer-text');
const linkToCadastro = document.getElementById('link-to-cadastro');
const loginError = document.getElementById('login-error');
const cadastroError = document.getElementById('cadastro-error');

// Portal
const welcomeName = document.getElementById('welcome-name');
const userDisplayName = document.getElementById('user-display-name');
const userAvatarInitials = document.getElementById('user-avatar-initials');
const btnLogout = document.getElementById('btn-logout');

// Stats
const statTotal = document.getElementById('stat-total');
const statHoje = document.getElementById('stat-hoje');
const statSemana = document.getElementById('stat-semana');

// Calendar
const calMonthYear = document.getElementById('cal-month-year');
const calDays = document.getElementById('cal-days');
const calPrev = document.getElementById('cal-prev');
const calNext = document.getElementById('cal-next');
const dayTitle = document.getElementById('day-title');
const dayAulasList = document.getElementById('day-aulas-list');

// Agendamento modal
const modalAgendar = document.getElementById('modal-agendar');
const formAgendar = document.getElementById('form-agendar');
const btnAgendar = document.getElementById('btn-agendar');
const btnCancelarAgendar = document.getElementById('btn-cancelar-agendar');
const modalCloseAgendar = document.getElementById('modal-close-agendar');
const agendarAlunoNome = document.getElementById('agendar-aluno-nome');
const agendarAlunoId = document.getElementById('agendar-aluno-id');
const agendarData = document.getElementById('agendar-data');
const agendarDisciplina = document.getElementById('agendar-disciplina');
const agendarInicio = document.getElementById('agendar-inicio');
const agendarFim = document.getElementById('agendar-fim');
const agendarObs = document.getElementById('agendar-obs');
const agendarErrorEl = document.getElementById('agendar-error');
const btnConfirmarAgendar = document.getElementById('btn-confirmar-agendar');

// Theme
const themeToggle = document.getElementById('theme-toggle');
const iconMoon = document.getElementById('icon-moon');
const iconSun = document.getElementById('icon-sun');

// Cadastro inputs
const cadNome = document.getElementById('cad-nome');
const cadCpf = document.getElementById('cad-cpf');
const cadEmail = document.getElementById('cad-email');
const cadTelefone = document.getElementById('cad-telefone');

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupAuthEvents();
  setupPortalEvents();
  populateHorarios();

  // Resolve o professor pelo slug da URL
  if (professorSlug) {
    try {
      const res = await fetch(`${API}/professores/slug/${encodeURIComponent(professorSlug)}`);
      if (res.ok) {
        currentProfessor = await res.json();
        // Exibe nome do professor na tela de login
        const titleEl = document.getElementById('auth-title');
        const subEl = document.getElementById('auth-subtitle');
        if (titleEl) titleEl.textContent = `Portal do Prof. ${currentProfessor.nome}`;
        if (subEl) subEl.textContent = `Acesse ou crie sua conta para agendar aulas com ${currentProfessor.nome}.`;
      } else {
        // Slug inválido
        document.getElementById('auth-screen').innerHTML = `
          <div style="text-align:center; padding:40px; color:var(--text-secondary);">
            <h2 style="color:var(--danger); margin-bottom:12px;">Link Inválido</h2>
            <p>Este link não corresponde a nenhum professor cadastrado.</p>
            <p style="margin-top:8px; font-size:12px;">Verifique o link com seu professor.</p>
          </div>
        `;
        return;
      }
    } catch (e) {
      console.error('Erro ao resolver professor:', e);
    }
  } else {
    // Sem slug: exibe mensagem genérica
    const subEl = document.getElementById('auth-subtitle');
    if (subEl) subEl.textContent = 'Acesse com o link fornecido pelo seu professor.';
  }

  // Verifica se há sessão salva (e se é do mesmo professor)
  const saved = localStorage.getItem('portal_aluno_session');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Valida que a sessão é do professor correto
      if (!currentProfessor || parsed.professorId === currentProfessor.id) {
        currentStudent = parsed;
        showPortal();
        return;
      }
    } catch (e) {}
    localStorage.removeItem('portal_aluno_session');
  }
  showAuth();
});

// ==========================================
// AUTENTICAÇÃO: TABS E FORMULÁRIOS
// ==========================================
function setupAuthEvents() {
  // Tabs
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabCadastro.addEventListener('click', () => switchTab('cadastro'));
  linkToCadastro.addEventListener('click', () => switchTab('cadastro'));

  // Login
  formLogin.addEventListener('submit', handleLogin);

  // Cadastro
  formCadastro.addEventListener('submit', handleCadastro);

  // Masks
  if (cadCpf) cadCpf.addEventListener('input', maskCPF);
  if (cadTelefone) cadTelefone.addEventListener('input', maskPhone);
}

function switchTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabCadastro.classList.remove('active');
    formLogin.classList.remove('hidden');
    formCadastro.classList.add('hidden');
    authFooterText.innerHTML = 'Não tem conta? <button class="link-btn" id="link-to-cadastro">Cadastre-se aqui</button>';
  } else {
    tabCadastro.classList.add('active');
    tabLogin.classList.remove('active');
    formCadastro.classList.remove('hidden');
    formLogin.classList.add('hidden');
    authFooterText.innerHTML = 'Já tem conta? <button class="link-btn" id="link-to-login">Faça login</button>';
  }
  // Re-bind links dinâmicos
  const linkCad = document.getElementById('link-to-cadastro');
  const linkLog = document.getElementById('link-to-login');
  if (linkCad) linkCad.addEventListener('click', () => switchTab('cadastro'));
  if (linkLog) linkLog.addEventListener('click', () => switchTab('login'));

  // Limpa erros
  loginError.classList.add('hidden');
  cadastroError.classList.add('hidden');
  clearErrors(formLogin);
  clearErrors(formCadastro);
}

async function handleLogin(e) {
  e.preventDefault();
  clearErrors(formLogin);
  loginError.classList.add('hidden');

  const query = document.getElementById('login-query').value.trim();
  if (!query) {
    showFieldError('err-login-query', 'Digite seu CPF ou E-mail.');
    return;
  }

  const btnLogin = document.getElementById('btn-login');
  btnLogin.disabled = true;
  btnLogin.querySelector('span').textContent = 'Entrando...';

  try {
    const params = new URLSearchParams({ q: query });
    if (currentProfessor) params.append('professorId', currentProfessor.id);
    const res = await fetch(`${API}/alunos/login?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || 'Não foi possível fazer login.';
      loginError.classList.remove('hidden');
      return;
    }

    currentStudent = data;
    localStorage.setItem('portal_aluno_session', JSON.stringify(currentStudent));
    showToast(`Bem-vindo(a), ${currentStudent.nome}!`, 'success');
    showPortal();
  } catch (err) {
    loginError.textContent = 'Erro de conexão com o servidor.';
    loginError.classList.remove('hidden');
  } finally {
    btnLogin.disabled = false;
    btnLogin.querySelector('span').textContent = 'Entrar na Conta';
  }
}

async function handleCadastro(e) {
  e.preventDefault();
  clearErrors(formCadastro);
  cadastroError.classList.add('hidden');

  const nome = cadNome.value.trim();
  const cpf = cadCpf.value.trim();
  const email = cadEmail.value.trim();
  const telefone = cadTelefone.value.trim();

  let hasError = false;

  if (!nome || nome.length < 3) {
    showFieldError('err-cad-nome', 'Nome completo (mín. 3 caracteres).');
    cadNome.classList.add('invalid');
    hasError = true;
  }
  if (!validateCPF(cpf)) {
    showFieldError('err-cad-cpf', 'CPF inválido ou incompleto.');
    cadCpf.classList.add('invalid');
    hasError = true;
  }
  if (!validateEmail(email)) {
    showFieldError('err-cad-email', 'E-mail inválido.');
    cadEmail.classList.add('invalid');
    hasError = true;
  }
  if (telefone.replace(/\D/g, '').length < 10) {
    showFieldError('err-cad-telefone', 'Telefone com DDD obrigatório.');
    cadTelefone.classList.add('invalid');
    hasError = true;
  }
  if (hasError) return;

  const btnCad = document.getElementById('btn-cadastrar');
  btnCad.disabled = true;
  btnCad.querySelector('span').textContent = 'Cadastrando...';

  try {
    const res = await fetch(`${API}/alunos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, cpf, email, telefone, professorId: currentProfessor ? currentProfessor.id : null })
    });
    const data = await res.json();

    if (!res.ok) {
      cadastroError.textContent = data.error || 'Erro ao cadastrar.';
      cadastroError.classList.remove('hidden');
      return;
    }

    // Auto-login
    currentStudent = data;
    localStorage.setItem('portal_aluno_session', JSON.stringify(currentStudent));
    showToast(`Conta criada! Bem-vindo(a), ${currentStudent.nome}!`, 'success');
    showPortal();
  } catch (err) {
    cadastroError.textContent = 'Erro de conexão com o servidor.';
    cadastroError.classList.remove('hidden');
  } finally {
    btnCad.disabled = false;
    btnCad.querySelector('span').textContent = 'Criar Conta e Entrar';
  }
}

// ==========================================
// TELAS: MOSTRAR / ESCONDER
// ==========================================
function showAuth() {
  authScreen.classList.remove('hidden');
  portalScreen.classList.add('hidden');
}

function showPortal() {
  authScreen.classList.add('hidden');
  portalScreen.classList.remove('hidden');

  // Atualiza informações do usuário
  const firstName = currentStudent.nome.split(' ')[0];
  welcomeName.textContent = firstName;
  userDisplayName.textContent = currentStudent.nome;
  userAvatarInitials.textContent = getInitials(currentStudent.nome);

  // Carrega dados
  loadDashboard();
  renderCalendar();
}

function handleLogout() {
  currentStudent = null;
  localStorage.removeItem('portal_aluno_session');
  formLogin.reset();
  formCadastro.reset();
  switchTab('login');
  showAuth();
  showToast('Sessão encerrada.', 'success');
}

// ==========================================
// EVENTOS DO PORTAL
// ==========================================
function setupPortalEvents() {
  btnLogout.addEventListener('click', handleLogout);

  // Calendário
  calPrev.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  calNext.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });

  // Agendamento
  btnAgendar.addEventListener('click', openAgendarModal);
  modalCloseAgendar.addEventListener('click', closeAgendarModal);
  btnCancelarAgendar.addEventListener('click', closeAgendarModal);
  modalAgendar.addEventListener('click', (e) => {
    if (e.target === modalAgendar) closeAgendarModal();
  });
  formAgendar.addEventListener('submit', handleAgendar);

  // Horário de início sugere término +1h
  agendarInicio.addEventListener('change', () => {
    const idx = agendarInicio.selectedIndex;
    if (idx + 2 < agendarFim.options.length) {
      agendarFim.selectedIndex = idx + 2;
    } else {
      agendarFim.selectedIndex = agendarFim.options.length - 1;
    }
  });
}

// ==========================================
// DASHBOARD: STATS
// ==========================================
async function loadDashboard() {
  if (!currentStudent) return;

  try {
    const params = new URLSearchParams({ alunoId: currentStudent.id });
    if (currentProfessor) params.append('professorId', currentProfessor.id);
    const res = await fetch(`${API}/agendamentos?${params.toString()}`);
    allAgendamentos = await res.json();

    const hoje = formatDateISO(new Date());

    // Total
    statTotal.textContent = allAgendamentos.length;

    // Hoje
    const hojeCount = allAgendamentos.filter(a => a.data === hoje).length;
    statHoje.textContent = hojeCount;

    // Semana
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const sW = formatDateISO(startOfWeek);
    const eW = formatDateISO(endOfWeek);
    const semanaCount = allAgendamentos.filter(a => a.data >= sW && a.data <= eW).length;
    statSemana.textContent = semanaCount;

    // Renderiza aulas do dia selecionado
    renderDayAulas();
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

// ==========================================
// CALENDÁRIO
// ==========================================
function renderCalendar() {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  calMonthYear.textContent = `${meses[currentMonth]} ${currentYear}`;

  calDays.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = formatDateISO(today);

  // Dias vazios antes do mês
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    calDays.appendChild(empty);
  }

  // Dias do mês
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = d;

    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // Marca hoje
    if (dateStr === todayStr) dayEl.classList.add('today');

    // Marca selecionado
    if (dateStr === selectedDate) dayEl.classList.add('selected');

    // Verifica se tem aulas nesse dia
    const temAula = allAgendamentos.some(a => a.data === dateStr);
    if (temAula) {
      const dot = document.createElement('div');
      dot.className = 'event-dot';
      dayEl.appendChild(dot);
    }

    // Click
    dayEl.addEventListener('click', () => {
      selectedDate = dateStr;
      renderCalendar();
      renderDayAulas();
    });

    calDays.appendChild(dayEl);
  }
}

function renderDayAulas() {
  const aulasNoDia = allAgendamentos
    .filter(a => a.data === selectedDate)
    .sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));

  // Atualiza título
  const [y, m, d] = selectedDate.split('-');
  dayTitle.textContent = `Aulas de ${d}/${m}/${y}`;

  if (aulasNoDia.length === 0) {
    dayAulasList.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted); margin-bottom:10px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <p>Nenhuma aula agendada para este dia.</p>
      </div>
    `;
    return;
  }

  dayAulasList.innerHTML = aulasNoDia.map(aula => `
    <div class="aula-item">
      <div class="aula-time">
        <span class="aula-time-start">${esc(aula.horarioInicio)}</span>
        <span class="aula-time-end">${esc(aula.horarioFim)}</span>
      </div>
      <div class="aula-info">
        <div class="aula-subject">${esc(aula.disciplina)}</div>
        <div class="aula-date">${d}/${m}/${y}</div>
        ${aula.observacoes ? `<div class="aula-notes">${esc(aula.observacoes)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ==========================================
// AGENDAMENTO
// ==========================================
function populateHorarios() {
  agendarInicio.innerHTML = '';
  agendarFim.innerHTML = '';

  const horarios = [];
  for (let h = 7; h <= 22; h++) {
    const hs = String(h).padStart(2, '0');
    horarios.push(`${hs}:00`);
    if (h !== 22) horarios.push(`${hs}:30`);
  }

  horarios.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    agendarInicio.appendChild(opt);
  });

  const finais = [...horarios.slice(1), '22:30', '23:00'];
  finais.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    agendarFim.appendChild(opt);
  });

  agendarInicio.value = '08:00';
  agendarFim.value = '09:00';
}

function openAgendarModal() {
  formAgendar.reset();
  agendarErrorEl.classList.add('hidden');
  clearErrors(formAgendar);

  // Preenche aluno e data
  agendarAlunoNome.value = currentStudent.nome;
  agendarAlunoId.value = currentStudent.id;
  agendarData.value = selectedDate;

  populateHorarios();
  modalAgendar.classList.add('active');
}

function closeAgendarModal() {
  modalAgendar.classList.remove('active');
}

async function handleAgendar(e) {
  e.preventDefault();
  clearErrors(formAgendar);
  agendarErrorEl.classList.add('hidden');

  const data = agendarData.value;
  const disciplina = agendarDisciplina.value.trim();
  const horarioInicio = agendarInicio.value;
  const horarioFim = agendarFim.value;
  const observacoes = agendarObs.value.trim();
  const alunoId = agendarAlunoId.value;

  let hasError = false;

  if (!data) {
    showFieldError('err-ag-data', 'Selecione uma data.');
    hasError = true;
  }
  if (!disciplina) {
    showFieldError('err-ag-disciplina', 'Digite a disciplina.');
    hasError = true;
  }
  if (horarioInicio >= horarioFim) {
    showFieldError('err-ag-fim', 'O término deve ser após o início.');
    hasError = true;
  }
  if (hasError) return;

  btnConfirmarAgendar.disabled = true;
  btnConfirmarAgendar.textContent = 'Agendando...';

  try {
    const res = await fetch(`${API}/agendamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alunoId, data, horarioInicio, horarioFim, disciplina, observacoes })
    });
    const result = await res.json();

    if (!res.ok) {
      agendarErrorEl.textContent = result.error || 'Erro ao agendar.';
      agendarErrorEl.classList.remove('hidden');
      // Shake animation
      modalAgendar.querySelector('.modal-box').animate([
        { transform: 'translateX(-8px)' },
        { transform: 'translateX(8px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' }
      ], { duration: 300 });
      return;
    }

    showToast(`Aula de ${result.disciplina} agendada com sucesso!`, 'success');
    closeAgendarModal();
    await loadDashboard();
    renderCalendar();
  } catch (err) {
    agendarErrorEl.textContent = 'Erro de conexão com o servidor.';
    agendarErrorEl.classList.remove('hidden');
  } finally {
    btnConfirmarAgendar.disabled = false;
    btnConfirmarAgendar.textContent = 'Confirmar Agendamento';
  }
}

// ==========================================
// TEMA (ESCURO/CLARO)
// ==========================================
function initTheme() {
  const saved = localStorage.getItem('portal_theme') || 'dark';
  applyTheme(saved);

  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    applyTheme(isDark ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    iconMoon.classList.add('hidden');
    iconSun.classList.remove('hidden');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    iconSun.classList.add('hidden');
    iconMoon.classList.remove('hidden');
  }
  localStorage.setItem('portal_theme', theme);
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const checkIcon = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const xIcon = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  toast.innerHTML = `${type === 'success' ? checkIcon : xIcon}<span>${esc(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.animate([
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(100%)', opacity: 0 }
    ], { duration: 300 }).onfinish = () => toast.remove();
  }, 3500);
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function esc(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors(form) {
  if (!form) return;
  form.querySelectorAll('.error-message').forEach(e => e.textContent = '');
  form.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
}

// Masks
function maskCPF(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
  e.target.value = v;
}

function maskPhone(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length === 11) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{1,4})$/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,5})$/, '($1) $2');
  else if (v.length > 0) v = v.replace(/^(\d*)$/, '($1');
  e.target.value = v;
}

function validateCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  let add = 0;
  for (let i = 0; i < 9; i++) add += parseInt(c.charAt(i)) * (10 - i);
  let rev = 11 - (add % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(c.charAt(9))) return false;
  add = 0;
  for (let i = 0; i < 10; i++) add += parseInt(c.charAt(i)) * (11 - i);
  rev = 11 - (add % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(c.charAt(10))) return false;
  return true;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
