/**
 * Links Hub - API Client
 * Centraliza a comunicação com as rotas backend do Express
 */

const BASE_URL = '/api';

/**
 * Trata as respostas HTTP gerando mensagens de erro amigáveis
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorMsg = 'Ocorreu um erro inesperado no servidor.';
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  return response.json();
}

// ==========================================
// PROFESSORES
// ==========================================

/**
 * Registra um novo professor
 * @param {Object} professor { nome, email, senha, slug? }
 */
export async function registrarProfessor(professor) {
  const res = await fetch(`${BASE_URL}/professores/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(professor)
  });
  return handleResponse(res);
}

/**
 * Autentica um professor por email + senha
 * @param {string} email
 * @param {string} senha
 */
export async function loginProfessor(email, senha) {
  const res = await fetch(`${BASE_URL}/professores/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
  });
  return handleResponse(res);
}

/**
 * Busca um professor pelo slug (para o portal do aluno)
 * @param {string} slug
 */
export async function getProfessorBySlug(slug) {
  const res = await fetch(`${BASE_URL}/professores/slug/${encodeURIComponent(slug)}`);
  return handleResponse(res);
}

// ==========================================
// ALUNOS
// ==========================================

/**
 * Retorna todos os alunos do professor
 * @param {string} professorId
 */
export async function getAlunos(professorId = null) {
  const params = professorId ? `?professorId=${encodeURIComponent(professorId)}` : '';
  const res = await fetch(`${BASE_URL}/alunos${params}`);
  return handleResponse(res);
}

/**
 * Pesquisa ativa de alunos cadastrados e ativos
 * @param {string} q Termo de busca (nome, email ou CPF)
 * @param {string} professorId Filtra pelo professor
 */
export async function buscarAlunos(q, professorId = null) {
  const params = new URLSearchParams({ q });
  if (professorId) params.append('professorId', professorId);
  const res = await fetch(`${BASE_URL}/alunos/busca?${params.toString()}`);
  return handleResponse(res);
}

/**
 * Cadastra um novo aluno no banco de dados
 * @param {Object} aluno { nome, email, telefone, cpf, professorId? }
 */
export async function cadastrarAluno(aluno) {
  const res = await fetch(`${BASE_URL}/alunos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aluno)
  });
  return handleResponse(res);
}

// ==========================================
// AGENDAMENTOS
// ==========================================

/**
 * Lista os agendamentos cadastrados (filtragem opcional)
 * @param {Object} filtros { data, de, ate, alunoId, professorId }
 */
export async function getAgendamentos(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.data)        params.append('data', filtros.data);
  if (filtros.de)          params.append('de', filtros.de);
  if (filtros.ate)         params.append('ate', filtros.ate);
  if (filtros.alunoId)     params.append('alunoId', filtros.alunoId);
  if (filtros.professorId) params.append('professorId', filtros.professorId);

  const res = await fetch(`${BASE_URL}/agendamentos?${params.toString()}`);
  return handleResponse(res);
}

/**
 * Cria um agendamento de aula no banco
 * @param {Object} agendamento { alunoId, data, horarioInicio, horarioFim, disciplina, observacoes }
 */
export async function criarAgendamento(agendamento) {
  const res = await fetch(`${BASE_URL}/agendamentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agendamento)
  });
  return handleResponse(res);
}

/**
 * Cancela/Deleta um agendamento existente pelo ID
 * @param {string} id ID do agendamento
 */
export async function cancelarAgendamento(id) {
  const res = await fetch(`${BASE_URL}/agendamentos/${id}`, {
    method: 'DELETE'
  });
  return handleResponse(res);
}
