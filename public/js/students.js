import { cadastrarAluno, getAlunos } from './api.js';
import { showToast, getCurrentProfessorId } from './app.js';

// Elementos DOM
const searchInput = document.getElementById('search-alunos-input');
const tableBody = document.getElementById('alunos-table-body');
const modalAluno = document.getElementById('modal-aluno');
const formAluno = document.getElementById('form-aluno');
const modalTitle = document.getElementById('modal-aluno-title');
const btnSalvar = document.getElementById('btn-salvar-aluno');
const globalError = document.getElementById('form-aluno-global-error');

// Inputs do Formulário
const inputNome = document.getElementById('aluno-nome');
const inputCpf = document.getElementById('aluno-cpf');
const inputEmail = document.getElementById('aluno-email');
const inputTelefone = document.getElementById('aluno-telefone');

// Lista em memória cache local para filtragem instantânea no front-end
let alunosCache = [];

/**
 * Inicializa a Área de Alunos
 */
export async function initStudents() {
  setupEventListeners();
  await carregarAlunos();
}

/**
 * Configura os ouvintes de eventos da página
 */
function setupEventListeners() {
  // Input de pesquisa dinâmico (filtro na tabela local)
  if (searchInput) {
    searchInput.addEventListener('input', () => filtrarTabela(searchInput.value));
  }

  // Envio de formulário de cadastro
  if (formAluno) {
    formAluno.addEventListener('submit', handleFormSubmit);
  }

  // Aplicar máscaras de CPF e Telefone ao digitar
  if (inputCpf) {
    inputCpf.addEventListener('input', aplicarMascaraCPF);
  }
  if (inputTelefone) {
    inputTelefone.addEventListener('input', aplicarMascaraTelefone);
  }
}

/**
 * Retorna o cache de alunos para outros módulos
 */
export function getAlunosCache() {
  return alunosCache;
}

/**
 * Carrega a lista completa de alunos do backend
 */
export async function carregarAlunos() {
  try {
    const professorId = getCurrentProfessorId();
    alunosCache = await getAlunos(professorId);
    renderAlunos(alunosCache);
    
    // Atualiza indicadores do painel caso a função de estatísticas esteja ativa
    const event = new CustomEvent('alunosAtualizados', { detail: alunosCache });
    document.dispatchEvent(event);
  } catch (error) {
    console.error('Erro ao carregar alunos:', error);
    showToast('Não foi possível carregar a lista de alunos.', 'error');
  }
}

/**
 * Renderiza os alunos na tabela HTML
 */
function renderAlunos(alunosList) {
  if (!tableBody) return;
  
  if (alunosList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">Nenhum aluno encontrado no banco de dados.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = alunosList.map(aluno => `
    <tr id="aluno-row-${aluno.id}">
      <td style="font-weight: 700;">${escapeHTML(aluno.nome)}</td>
      <td>${escapeHTML(aluno.cpf)}</td>
      <td>${escapeHTML(aluno.email)}</td>
      <td>${escapeHTML(aluno.telefone)}</td>
      <td>
        <span class="status-badge ${aluno.status}">${aluno.status}</span>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm flex-btn" onclick="window.agendarParaAluno('${aluno.id}', '${aluno.nome}')" title="Agendar aula para este aluno">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>Agendar</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Filtra a tabela localmente sem novas requisições para performance ultra-rápida
 */
function filtrarTabela(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderAlunos(alunosCache);
    return;
  }

  const filtrados = alunosCache.filter(aluno => 
    aluno.nome.toLowerCase().includes(q) ||
    aluno.cpf.includes(q) ||
    aluno.email.toLowerCase().includes(q) ||
    aluno.telefone.includes(q)
  );

  renderAlunos(filtrados);
}

/**
 * Trata o envio do formulário de cadastro de alunos
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  // Limpar erros anteriores
  limparErros();
  globalError.classList.add('hidden');

  const nome = inputNome.value.trim();
  const cpf = inputCpf.value.trim();
  const email = inputEmail.value.trim();
  const telefone = inputTelefone.value.trim();

  // Validações no Frontend
  let hasError = false;

  if (!nome || nome.length < 3) {
    mostrarErro('err-nome', 'Digite o nome completo do aluno (mínimo 3 caracteres).');
    inputNome.classList.add('invalid');
    hasError = true;
  }

  if (!validaCPF(cpf)) {
    mostrarErro('err-cpf', 'CPF inválido ou incompleto.');
    inputCpf.classList.add('invalid');
    hasError = true;
  }

  if (!validaEmail(email)) {
    mostrarErro('err-email', 'Digite um endereço de e-mail válido.');
    inputEmail.classList.add('invalid');
    hasError = true;
  }

  if (telefone.replace(/\D/g, '').length < 10) {
    mostrarErro('err-telefone', 'Digite um telefone válido com DDD.');
    inputTelefone.classList.add('invalid');
    hasError = true;
  }

  if (hasError) return;

  // Enviar dados para API
  btnSalvar.disabled = true;
  btnSalvar.innerText = 'Salvando...';

  try {
    const professorId = getCurrentProfessorId();
    const novoAluno = await cadastrarAluno({ nome, email, telefone, cpf, professorId });
    
    showToast(`Aluno "${novoAluno.nome}" cadastrado com sucesso!`, 'success');
    
    // Fecha o modal limpando o form
    fecharModalAluno();
    
    // Recarrega lista
    await carregarAlunos();
  } catch (error) {
    console.error('Erro ao cadastrar:', error);
    globalError.innerText = error.message || 'Erro ao realizar cadastro do aluno.';
    globalError.classList.remove('hidden');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerText = 'Cadastrar Aluno';
  }
}

/**
 * Funções de Abertura e Fechamento do Modal
 */
export function abrirModalAluno() {
  limparFormulario();
  modalTitle.innerText = 'Cadastrar Novo Aluno';
  modalAluno.classList.add('active');
  inputNome.focus();
}

export function fecharModalAluno() {
  modalAluno.classList.remove('active');
  limparFormulario();
}

function limparFormulario() {
  formAluno.reset();
  limparErros();
  globalError.classList.add('hidden');
}

function limparErros() {
  const errors = document.querySelectorAll('.error-message');
  errors.forEach(err => err.innerText = '');
  
  const inputs = formAluno.querySelectorAll('input');
  inputs.forEach(input => input.classList.remove('invalid'));
}

function mostrarErro(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.innerText = message;
}

// ==========================================
// MÁSCARAS E VALIDAÇÕES AUXILIARES
// ==========================================

function aplicarMascaraCPF(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);
  
  if (value.length > 9) {
    value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
  } else if (value.length > 6) {
    value = value.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
  } else if (value.length > 3) {
    value = value.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
  }
  
  e.target.value = value;
}

function aplicarMascaraTelefone(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length === 11) {
    value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (value.length > 6) {
    value = value.replace(/^(\d{2})(\d{4})(\d{1,4})$/, '($1) $2-$3');
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d{1,5})$/, '($1) $2');
  } else if (value.length > 0) {
    value = value.replace(/^(\d*)$/, '($1');
  }
  
  e.target.value = value;
}

function validaCPF(cpf) {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  
  // Elimina CPFs conhecidos inválidos
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
  
  // Valida 1o dígito
  let add = 0;
  for (let i = 0; i < 9; i++) add += parseInt(cleanCpf.charAt(i)) * (10 - i);
  let rev = 11 - (add % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(9))) return false;
  
  // Valida 2o dígito
  add = 0;
  for (let i = 0; i < 10; i++) add += parseInt(cleanCpf.charAt(i)) * (11 - i);
  rev = 11 - (add % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(10))) return false;
  
  return true;
}

function validaEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
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
