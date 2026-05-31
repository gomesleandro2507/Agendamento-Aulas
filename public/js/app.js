import { initStudents, abrirModalAluno, fecharModalAluno } from './students.js';
import { initCalendar, carregarMesAtual } from './calendar.js';
import { initBooking, abrirModalAgendamento, fecharModalAgendamento } from './booking.js';
import { getAgendamentos, getAlunos, buscarAlunos, loginProfessor, registrarProfessor } from './api.js';

// Estado Global de Acesso/Sessão
let currentRole = 'professor'; // 'professor' | 'aluno'
let currentStudent = null;     // Aluno ativo simulando login
let currentProfessor = null;   // Professor logado { id, nome, email, slug }

// Elementos DOM Globais
const viewTitle = document.getElementById('view-title');
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');

// Tema
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const moonIcon = document.getElementById('moon-icon');
const sunIcon = document.getElementById('sun-icon');
const themeText = document.getElementById('theme-text');

// Modais Ouvintes de Fechamento Globais
const modalCloseButtons = document.querySelectorAll('.modal-close-btn');
const modalOverlays = document.querySelectorAll('.modal-overlay');

// Botoes de Abertura de Agendamento/Aluno
const headerBtnAluno = document.getElementById('header-btn-aluno');
const headerBtnAgendar = document.getElementById('header-btn-agendar');
const dashBtnCadastrar = document.getElementById('dash-btn-cadastrar');
const dashGoToCalendar = document.getElementById('go-to-calendar-btn');
const btnAgendarDiaSelec = document.getElementById('btn-agendar-dia-selecionado');
const btnAbrirCadAlunoTab = document.getElementById('btn-abrir-cadastro-aluno');

// Dashboard stats
const statAlunosVal = document.getElementById('stat-alunos');
const statAulasHojeVal = document.getElementById('stat-aulas-hoje');
const statAulasSemanaVal = document.getElementById('stat-aulas-semana');
const dashAgendaList = document.getElementById('dashboard-agenda-list');

// Elementos de Acesso Múltiplo
const roleBtnProfessor = document.getElementById('role-btn-professor');
const roleBtnAluno = document.getElementById('role-btn-aluno');
const studentProfileCard = document.getElementById('student-profile-card');
const loggedStudentName = document.getElementById('logged-student-name');
const loggedStudentEmail = document.getElementById('logged-student-email');
const btnTrocarAlunoLogin = document.getElementById('btn-trocar-aluno-login');

// Modal Login Aluno
const modalLoginAluno = document.getElementById('modal-login-aluno');
const loginAlunoBusca = document.getElementById('login-aluno-busca');
const loginAlunoIdSeleccionado = document.getElementById('login-aluno-id-selecionado');
const loginAutocompleteBox = document.getElementById('login-autocomplete-box');
const btnCancelarLoginAluno = document.getElementById('btn-cancelar-login-aluno');
const btnConfirmarLoginAluno = document.getElementById('btn-confirmar-login-aluno');
const btnLoginNovoCadastro = document.getElementById('btn-login-novo-cadastro');

let loginDebounce = null;
let isRegisteringFromLogin = false; // Flag para auto-login pós-cadastro
let appJaInicializado = false;       // Evita double-init dos módulos

/**
 * getters para controle dos módulos secundários
 */
export function getCurrentRole() {
  return currentRole;
}

export function getCurrentStudent() {
  return currentStudent;
}

export function getCurrentProfessorId() {
  return currentProfessor ? currentProfessor.id : null;
}

/**
 * Inicialização Completa da SPA ao carregar a página
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa o tema salvo no localStorage
  inicializarTema();

  // Configura formulários do overlay de professor (deve ser antes de esconder)
  configurarAuthProfessor();

  // Verifica sessão do professor
  const sessaoSalva = localStorage.getItem('professor_session');
  if (sessaoSalva) {
    try {
      currentProfessor = JSON.parse(sessaoSalva);
      esconderOverlayProfessor();
      await inicializarApp();
    } catch (e) {
      console.error('Sessão inválida:', e);
      localStorage.removeItem('professor_session');
      mostrarOverlayProfessor();
    }
  } else {
    mostrarOverlayProfessor();
  }
});

async function inicializarApp() {
  // Evita inicializar módulos mútuos múltiplas vezes
  if (appJaInicializado) {
    await carregarDashboardStats();
    atualizarLinkProfessor();
    return;
  }
  appJaInicializado = true;

  // Inicializa os módulos específicos do sistema
  await initStudents();
  await initCalendar();
  initBooking();

  // Configura os ouvintes de eventos da estrutura SPA
  configurarNavegacaoSPA();
  configurarModaisEventos();
  configurarEventosGerais();
  configurarAcessoMultiplo();

  // Carrega as estatísticas do Dashboard na abertura
  await carregarDashboardStats();

  // Exibe o link exclusivo do professor no dashboard
  atualizarLinkProfessor();
}

// ==========================================
// ROTEAMENTO INTERNO SPA (TROCA DE ABAS)
// ==========================================

function configurarNavegacaoSPA() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-target');
      
      // Atualiza estado ativo na sidebar
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Mostra a seção correspondente
      viewSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${targetView}-view`) {
          section.classList.add('active');
        }
      });

      // Atualiza o título do header principal
      const titulos = {
        dashboard: currentRole === 'aluno' ? 'Meu Painel de Aluno' : 'Painel Geral',
        alunos: 'Área do Aluno (Banco de Dados)',
        agenda: currentRole === 'aluno' ? 'Minha Agenda de Aulas' : 'Agenda e Horários de Aulas'
      };
      if (viewTitle) {
        viewTitle.innerText = titulos[targetView] || 'Links Hub';
      }
    });
  });
}

// ==========================================
// CONTROLE E OUVIDORES DE MODAIS
// ==========================================

function configurarModaisEventos() {
  // Configura botões de fechar dos modais (geral)
  modalCloseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      fecharModalAluno();
      fecharModalAgendamento();
      fecharModalLogin();
    });
  });

  // Fecha modais ao clicar no background escuro transparente
  modalOverlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && overlay.id !== 'modal-login-aluno') {
        fecharModalAluno();
        fecharModalAgendamento();
      }
    });
  });

  // Configura atalhos de abertura nos botões principais
  if (headerBtnAluno) headerBtnAluno.addEventListener('click', abrirModalAluno);
  if (btnAbrirCadAlunoTab) btnAbrirCadAlunoTab.addEventListener('click', abrirModalAluno);
  if (dashBtnCadastrar) dashBtnCadastrar.addEventListener('click', abrirModalAluno);

  if (headerBtnAgendar) headerBtnAgendar.addEventListener('click', () => abrirModalAgendamento());
  if (btnAgendarDiaSelec) btnAgendarDiaSelec.addEventListener('click', () => abrirModalAgendamento());

  // Link rápido do Dashboard para a aba de Agenda
  if (dashGoToCalendar) {
    dashGoToCalendar.addEventListener('click', () => {
      const navAgenda = document.querySelector('.nav-item[data-target="agenda"]');
      if (navAgenda) navAgenda.click();
    });
  }
}

// ==========================================
// LOGICA DE MULTIPLOS ACESSOS (ROLE SWITCHER & LOGIN)
// ==========================================

function configurarAcessoMultiplo() {
  // Switch para Professor
  if (roleBtnProfessor) {
    roleBtnProfessor.addEventListener('click', () => {
      mudarPerfil('professor');
    });
  }

  // Switch para Aluno
  if (roleBtnAluno) {
    roleBtnAluno.addEventListener('click', () => {
      if (!currentStudent) {
        abrirModalLogin();
      } else {
        mudarPerfil('aluno');
      }
    });
  }

  // Autocomplete na barra de pesquisa de login de aluno
  if (loginAlunoBusca) {
    loginAlunoBusca.addEventListener('input', handleLoginBuscaInput);
    
    // Esconde autocomplete de login ao clicar fora
    document.addEventListener('click', (e) => {
      if (!loginAlunoBusca.contains(e.target) && !loginAutocompleteBox.contains(e.target)) {
        loginAutocompleteBox.classList.add('hidden');
      }
    });
  }

  // Botões do Modal de Login
  if (btnCancelarLoginAluno) {
    btnCancelarLoginAluno.addEventListener('click', () => {
      fecharModalLogin();
      // Retorna visualmente o botão ativo para professor
      roleBtnProfessor.classList.add('active');
      roleBtnAluno.classList.remove('active');
    });
  }

  if (btnConfirmarLoginAluno) {
    btnConfirmarLoginAluno.addEventListener('click', confirmLoginAluno);
  }

  // Atalho para cadastrar novo aluno direto de dentro do modal de login
  if (btnLoginNovoCadastro) {
    btnLoginNovoCadastro.addEventListener('click', () => {
      isRegisteringFromLogin = true; // Ativa flag de redirecionamento de login
      fecharModalLogin();
      abrirModalAluno();
    });
  }

  // Ação de Sair/Trocar Aluno na barra lateral
  if (btnTrocarAlunoLogin) {
    btnTrocarAlunoLogin.addEventListener('click', () => {
      currentStudent = null;
      mudarPerfil('professor');
      showToast('Sessão de aluno encerrada.', 'success');
    });
  }
}

/**
 * Alterna dinamicamente a interface e as classes do CSS conforme o papel ativo
 */
function mudarPerfil(role, aluno = null) {
  currentRole = role;
  
  if (role === 'aluno') {
    if (aluno) currentStudent = aluno;
    
    document.body.classList.remove('role-professor');
    document.body.classList.add('role-aluno');
    
    // Atualiza botão do switcher
    roleBtnAluno.classList.add('active');
    roleBtnProfessor.classList.remove('active');
    
    // Carrega dados do aluno no widget da sidebar
    if (currentStudent) {
      loggedStudentName.innerText = currentStudent.nome;
      loggedStudentEmail.innerText = currentStudent.email;
      studentProfileCard.classList.remove('hidden');
    }

    // Se estiver na aba "Alunos" (que está oculta para o aluno), redireciona para o Painel
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && activeNav.getAttribute('data-target') === 'alunos') {
      const navDashboard = document.querySelector('.nav-item[data-target="dashboard"]');
      if (navDashboard) navDashboard.click();
    }
  } else {
    currentStudent = null;
    document.body.classList.remove('role-aluno');
    document.body.classList.add('role-professor');
    
    roleBtnProfessor.classList.add('active');
    roleBtnAluno.classList.remove('active');
    
    studentProfileCard.classList.add('hidden');
  }

  // Atualiza os títulos das abas ativas
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) {
    activeNav.click(); // Força o clique para atualizar o título do header conforme o papel
  }

  // Notifica o calendário e o dashboard para refazerem as buscas filtradas
  const event = new Event('agendamentosAtualizados');
  document.dispatchEvent(event);
}

function abrirModalLogin() {
  loginAlunoBusca.value = '';
  loginAlunoIdSeleccionado.value = '';
  btnConfirmarLoginAluno.disabled = true;
  loginAutocompleteBox.classList.add('hidden');
  modalLoginAluno.classList.add('active');
  loginAlunoBusca.focus();
}

function fecharModalLogin() {
  modalLoginAluno.classList.remove('active');
}

/**
 * Busca alunos ativos para simulação de login
 */
function handleLoginBuscaInput(e) {
  const query = e.target.value;
  btnConfirmarLoginAluno.disabled = true;
  loginAlunoIdSeleccionado.value = '';

  clearTimeout(loginDebounce);
  
  if (query.trim().length < 2) {
    loginAutocompleteBox.classList.add('hidden');
    return;
  }

  loginDebounce = setTimeout(async () => {
    try {
      const resultados = await buscarAlunos(query);
      renderResultadosLoginAutocomplete(resultados);
    } catch (error) {
      console.error(error);
    }
  }, 200);
}

function renderResultadosLoginAutocomplete(resultados) {
  loginAutocompleteBox.innerHTML = '';
  loginAutocompleteBox.classList.remove('hidden');

  if (resultados.length === 0) {
    loginAutocompleteBox.innerHTML = `
      <div class="autocomplete-no-results">
        <span>Nenhum cadastro ativo encontrado.</span>
      </div>
    `;
    return;
  }

  resultados.forEach(aluno => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.innerHTML = `
      <div class="aluno-nome">${escapeHTML(aluno.nome)}</div>
      <div class="aluno-meta">CPF: ${escapeHTML(aluno.cpf)}</div>
    `;
    
    item.addEventListener('click', () => {
      loginAlunoIdSeleccionado.value = aluno.id;
      loginAlunoBusca.value = aluno.nome;
      btnConfirmarLoginAluno.disabled = false;
      loginAutocompleteBox.classList.add('hidden');
    });

    loginAutocompleteBox.appendChild(item);
  });
}

/**
 * Confirma o login do aluno selecionado
 */
async function confirmLoginAluno() {
  const id = loginAlunoIdSeleccionado.value;
  const nome = loginAlunoBusca.value;

  if (!id) return;

  const selecionado = { id, nome, email: '' };
  
  // Puxa e popula as informações completas do aluno logado
  try {
    const todos = await getAlunos();
    const alunoCompleto = todos.find(a => a.id === id);
    if (alunoCompleto) {
      selecionado.email = alunoCompleto.email;
    }
  } catch (e) {
    // Fallback silencioso
  }

  fecharModalLogin();
  mudarPerfil('aluno', selecionado);
  showToast(`Conectado como aluno: ${selecionado.nome}`, 'success');
}

// ==========================================
// ATALHOS GLOBAIS DO WINDOW (AÇÕES DE OUTROS MÓDULOS)
// ==========================================

/**
 * Atalho chamado a partir da tabela de alunos (student.js) para agendar aula direto
 */
window.agendarParaAluno = function(id, nome) {
  // Navega até a aba Agenda visualmente para ambientar o usuário
  const navAgenda = document.querySelector('.nav-item[data-target="agenda"]');
  if (navAgenda) navAgenda.click();
  
  // Abre o modal pré-selecionando o aluno
  abrirModalAgendamento(id, nome);
};

// ==========================================
// CONTROLE DO TEMA (ESCURO / CLARO)
// ==========================================

function inicializarTema() {
  const temaSalvo = localStorage.getItem('theme') || 'dark';
  
  if (temaSalvo === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
    themeText.innerText = 'Modo Escuro';
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
    themeText.innerText = 'Modo Claro';
  }

  // Switcher Click
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      
      if (isDark) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        moonIcon.classList.add('hidden');
        sunIcon.classList.remove('hidden');
        themeText.innerText = 'Modo Escuro';
        localStorage.setItem('theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
        themeText.innerText = 'Modo Claro';
        localStorage.setItem('theme', 'dark');
      }
    });
  }
}

// ==========================================
// CARREGAMENTO DOS DADOS DO DASHBOARD
// ==========================================

function configurarEventosGerais() {
  // Recarrega estatísticas do dashboard sempre que o banco de dados de alunos sofrer alteração
  document.addEventListener('alunosAtualizados', async (e) => {
    if (currentRole === 'professor' && statAlunosVal) {
      statAlunosVal.innerText = e.detail.length;
    }

    // Auto login se o cadastro do aluno foi efetuado a partir da tela de login do portal do aluno
    if (isRegisteringFromLogin && e.detail.length > 0) {
      isRegisteringFromLogin = false;
      // Pega o último aluno cadastrado (que acabou de ser inserido)
      const novoAluno = e.detail[e.detail.length - 1];
      mudarPerfil('aluno', novoAluno);
      showToast(`Cadastro efetuado! Conectado automaticamente como: ${novoAluno.nome}`, 'success');
    }
  });

  document.addEventListener('agendamentosAtualizados', async () => {
    await carregarDashboardStats();
  });
}

/**
 * Calcula e atualiza os cards estatísticos e a lista de próximas aulas (Filtrado por papel)
 */
async function carregarDashboardStats() {
  try {
    let agendamentos = [];
    
    // Configura os textos dos cabeçalhos dos cartões baseado no papel
    const cardAlunosHeader = statAlunosVal.closest('.stat-card').querySelector('h3');
    const cardSemanaHeader = statAulasSemanaVal.closest('.stat-card').querySelector('h3');

    if (currentRole === 'aluno' && currentStudent) {
      // 1. Visão Restrita do Aluno: Carrega apenas aulas dele
      agendamentos = await getAgendamentos({ alunoId: currentStudent.id });
      
      cardAlunosHeader.innerText = 'Minhas Aulas';
      cardSemanaHeader.innerText = 'Minhas Aulas/Semana';
      
      if (statAlunosVal) {
        statAlunosVal.innerText = agendamentos.length;
      }
    } else {
      // 2. Visão Master do Professor: Carrega dados do professor
      const professorId = getCurrentProfessorId();
      const alunos = await getAlunos(professorId);
      if (statAlunosVal) {
        statAlunosVal.innerText = alunos.length;
      }
      
      agendamentos = await getAgendamentos({ professorId });
      
      cardAlunosHeader.innerText = 'Total de Alunos';
      cardSemanaHeader.innerText = 'Aulas na Semana';
    }

    // Data de hoje formatada (YYYY-MM-DD)
    const hojeObj = new Date();
    const hojeStr = formatarDataISO(hojeObj);

    // Contagem hoje
    const hojeCount = agendamentos.filter(ag => ag.data === hojeStr).length;
    if (statAulasHojeVal) {
      statAulasHojeVal.innerText = hojeCount;
    }

    // Contagem da semana corrente (Domingo a Sábado)
    const inicioSemana = new Date(hojeObj);
    inicioSemana.setDate(hojeObj.getDate() - hojeObj.getDay()); // Domingo
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6); // Sábado

    const semanaDe = formatarDataISO(inicioSemana);
    const semanaAte = formatarDataISO(fimSemana);

    const semanaCount = agendamentos.filter(ag => ag.data >= semanaDe && ag.data <= semanaAte).length;
    if (statAulasSemanaVal) {
      statAulasSemanaVal.innerText = semanaCount;
    }

    // Renderiza lista das próximas 5 aulas futuras
    renderizarProximasAulas(agendamentos, hojeStr);
  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error);
  }
}

/**
 * Lista as próximas aulas (hoje ou no futuro) de forma ordenada no Dashboard
 */
function renderizarProximasAulas(agendamentos, hojeStr) {
  if (!dashAgendaList) return;

  // Filtra apenas aulas de hoje em diante
  const futuras = agendamentos.filter(ag => ag.data >= hojeStr);

  if (futuras.length === 0) {
    dashAgendaList.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); margin-bottom: 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <p>${currentRole === 'aluno' ? 'Você não possui próximas aulas agendadas.' : 'Excelente! Sem mais aulas pendentes na agenda para os próximos dias.'}</p>
      </div>
    `;
    return;
  }

  // Ordena por data e horário de início, pegando as 5 primeiras
  const proximas = futuras.slice(0, 5);

  dashAgendaList.innerHTML = proximas.map(aula => {
    const dataFormatada = formatarDataBR(aula.data);
    const alunoNome = aula.aluno ? aula.aluno.nome : 'Aluno Excluído';
    
    // O aluno não precisa ver o botão "Desmarcar" no Dashboard se for desabilitado, 
    // mas incluímos validação visual no HTML de acordo com o papel.
    const desmarcarBtn = currentRole === 'professor' 
      ? `<button class="btn btn-secondary btn-sm" onclick="window.cancelarAula('${aula.id}', '${escapeHTML(alunoNome)}')">Desmarcar</button>`
      : '';

    return `
      <div class="agenda-item">
        <div class="agenda-time">
          <span class="time-badge">${aula.horarioInicio} - ${aula.horarioFim}</span>
          <span class="date-text">${dataFormatada}</span>
        </div>
        <div class="agenda-details">
          <span class="agenda-subject">${escapeHTML(aula.disciplina)}</span>
          <div class="agenda-student">Aluno: <strong>${escapeHTML(alunoNome)}</strong></div>
        </div>
        ${desmarcarBtn}
      </div>
    `;
  }).join('');
}

// ==========================================
// NOTIFICAÇÕES TOAST (EFEITOS VISUAIS)
// ==========================================

/**
 * Cria e exibe um balão flutuante de notificação na tela com auto-close
 * @param {string} message Mensagem a exibir
 * @param {string} type 'success' ou 'error'
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Ícones inline SVG conforme o tipo
  const checkIcon = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const xIcon = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  toast.innerHTML = `
    ${type === 'success' ? checkIcon : xIcon}
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  // Remove o elemento após 3.5 segundos com micro-transição
  setTimeout(() => {
    toast.animate([
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(100%)', opacity: 0 }
    ], { duration: 300 }).onfinish = () => {
      toast.remove();
    };
  }, 3500);
}

// ==========================================
// FUNÇÕES AUXILIARES DE DATA E ESCAPES
// ==========================================

function formatarDataISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarDataBR(dateStr) {
  const [ano, mes, dia] = dateStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ==========================================
// AUTENTICACAO DO PROFESSOR (OVERLAY)
// ==========================================

function mostrarOverlayProfessor() {
  const overlay = document.getElementById('professor-auth-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function esconderOverlayProfessor() {
  const overlay = document.getElementById('professor-auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

function configurarAuthProfessor() {
  const tabLogin    = document.getElementById('prof-tab-login');
  const tabRegistro = document.getElementById('prof-tab-registro');
  const formLogin   = document.getElementById('form-prof-login');
  const formReg     = document.getElementById('form-prof-registro');

  // Alterna tabs
  tabLogin?.addEventListener('click', () => {
    tabLogin.style.background = 'var(--primary)';
    tabLogin.style.color = '#fff';
    tabLogin.style.boxShadow = '0 2px 8px var(--primary-glow)';
    tabRegistro.style.background = 'none';
    tabRegistro.style.color = 'var(--text-secondary)';
    tabRegistro.style.boxShadow = 'none';
    formLogin.style.display = 'block';
    formReg.style.display = 'none';
  });

  tabRegistro?.addEventListener('click', () => {
    tabRegistro.style.background = 'var(--primary)';
    tabRegistro.style.color = '#fff';
    tabRegistro.style.boxShadow = '0 2px 8px var(--primary-glow)';
    tabLogin.style.background = 'none';
    tabLogin.style.color = 'var(--text-secondary)';
    tabLogin.style.boxShadow = 'none';
    formReg.style.display = 'block';
    formLogin.style.display = 'none';
  });

  // Login
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('prof-login-email').value.trim();
    const senha = document.getElementById('prof-login-senha').value;
    const errEl = document.getElementById('prof-login-error');
    errEl.style.display = 'none';
    const btn = formLogin.querySelector('button[type="submit"]');
    btn.textContent = 'Entrando...';
    btn.disabled = true;
    try {
      const professor = await loginProfessor(email, senha);
      currentProfessor = professor;
      localStorage.setItem('professor_session', JSON.stringify(professor));
      esconderOverlayProfessor();
      await inicializarApp();
      showToast(`Bem-vindo(a), ${professor.nome}!`, 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.textContent = 'Entrar no Painel';
      btn.disabled = false;
    }
  });

  // Registro
  formReg?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome  = document.getElementById('prof-reg-nome').value.trim();
    const email = document.getElementById('prof-reg-email').value.trim();
    const senha = document.getElementById('prof-reg-senha').value;
    const slug  = document.getElementById('prof-reg-slug').value.trim();
    const errEl = document.getElementById('prof-reg-error');
    errEl.style.display = 'none';
    if (!nome || !email || !senha) {
      errEl.textContent = 'Nome, E-mail e Senha são obrigatórios.';
      errEl.style.display = 'block';
      return;
    }
    const btn = formReg.querySelector('button[type="submit"]');
    btn.textContent = 'Criando conta...';
    btn.disabled = true;
    try {
      const professor = await registrarProfessor({ nome, email, senha, slug });
      currentProfessor = professor;
      localStorage.setItem('professor_session', JSON.stringify(professor));
      esconderOverlayProfessor();
      await inicializarApp();
      showToast(`Conta criada! Bem-vindo(a), ${professor.nome}!`, 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.textContent = 'Criar Conta de Professor';
      btn.disabled = false;
    }
  });
}

/**
 * Exibe e configura o link exclusivo do professor no dashboard
 */
function atualizarLinkProfessor() {
  if (!currentProfessor) return;
  const linkEl  = document.getElementById('display-link-aluno');
  const btnCopy = document.getElementById('btn-copiar-link');
  if (!linkEl || !btnCopy) return;

  const link = `${window.location.origin}/aluno/${currentProfessor.slug}`;
  linkEl.textContent = link;

  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(link).then(() => {
      showToast('Link copiado! Compartilhe com seus alunos.', 'success');
      btnCopy.textContent = '✅ Copiado!';
      setTimeout(() => { btnCopy.textContent = '📋 Copiar Link'; }, 2000);
    });
  });
}
