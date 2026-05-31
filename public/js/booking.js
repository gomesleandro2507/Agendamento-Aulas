import { buscarAlunos, criarAgendamento } from './api.js';
import { showToast, getCurrentRole, getCurrentStudent, getCurrentProfessorId } from './app.js';
import { abrirModalAluno } from './students.js';
import { getDiaSelecionadoFormatado } from './calendar.js';

// Elementos DOM
const modalAgendar = document.getElementById('modal-agendamento');
const formAgendar = document.getElementById('form-agendamento');
const inputBuscaAluno = document.getElementById('busca-aluno-input');
const inputAlunoId = document.getElementById('agendar-aluno-id');
const badgeAlunoSelecionado = document.getElementById('selected-aluno-badge');
const autocompleteBox = document.getElementById('autocomplete-results-box');

const inputData = document.getElementById('agendar-data');
const inputDisciplina = document.getElementById('agendar-disciplina');
const selectInicio = document.getElementById('agendar-inicio');
const selectFim = document.getElementById('agendar-fim');
const inputObs = document.getElementById('agendar-observacoes');
const globalError = document.getElementById('form-agendamento-global-error');
const btnConfirmar = document.getElementById('btn-salvar-agendamento');

let debounceTimeout = null;

/**
 * Inicializa a Área de Agendamento
 */
export function initBooking() {
  popularHorarios();
  setupEventListeners();
}

/**
 * Configura os ouvintes de eventos do formulário de agendamento
 */
function setupEventListeners() {
  // Autocomplete - Busca de Alunos ao digitar
  if (inputBuscaAluno) {
    inputBuscaAluno.addEventListener('input', handleBuscaInput);
    
    // Esconde autocomplete ao clicar fora
    document.addEventListener('click', (e) => {
      if (!inputBuscaAluno.contains(e.target) && !autocompleteBox.contains(e.target)) {
        fecharAutocomplete();
      }
    });

    // Se limpar o campo de busca manualmente, limpa o aluno selecionado
    inputBuscaAluno.addEventListener('change', () => {
      if (inputBuscaAluno.value.trim() === '') {
        deselecionarAluno();
      }
    });
  }

  // Mudança inteligente do horário de início sugere término de 1h depois
  if (selectInicio && selectFim) {
    selectInicio.addEventListener('change', () => {
      const idx = selectInicio.selectedIndex;
      // Define o horário de término como duas posições à frente (1 hora de intervalo padrão)
      if (idx + 2 < selectFim.options.length) {
        selectFim.selectedIndex = idx + 2;
      } else {
        selectFim.selectedIndex = selectFim.options.length - 1;
      }
    });
  }

  // Submissão do formulário de agendamento
  if (formAgendar) {
    formAgendar.addEventListener('submit', handleFormSubmit);
  }
}

/**
 * Abre o modal de agendamento pré-configurando a data padrão e limpando formulário
 * @param {string} alunoId Opcional, ID do aluno pré-selecionado
 * @param {string} alunoNome Opcional, Nome do aluno pré-selecionado
 */
export function abrirModalAgendamento(alunoId = null, alunoNome = null) {
  limparFormulario();
  globalError.classList.add('hidden');
  
  // Define data do input com a data atualmente selecionada no calendário
  if (inputData) {
    inputData.value = getDiaSelecionadoFormatado();
  }

  const role = getCurrentRole();
  const student = getCurrentStudent();

  if (role === 'aluno' && student) {
    // Sobrescreve e força o agendamento para si mesmo
    selecionarAluno(student);
    // Remove o botão de reset (no Aluno ele não pode trocar o aluno logado de dentro do agendamento)
    badgeAlunoSelecionado.onclick = null;
    badgeAlunoSelecionado.title = 'Agendado para você';
    badgeAlunoSelecionado.style.cursor = 'default';
  } else if (alunoId && alunoNome) {
    // Pré-seleciona aluno se passado por parâmetro (ex: clicou em agendar direto na linha da tabela de alunos)
    selecionarAluno({ id: alunoId, nome: alunoNome });
  }

  modalAgendar.classList.add('active');
}

/**
 * Fecha o modal de agendamento
 */
export function fecharModalAgendamento() {
  modalAgendar.classList.remove('active');
  limparFormulario();
}

/**
 * Popula dinamicamente os comboboxes de horários de 30 em 30 minutos
 */
function popularHorarios() {
  if (!selectInicio || !selectFim) return;

  selectInicio.innerHTML = '';
  selectFim.innerHTML = '';

  const listaHorarios = [];
  for (let hora = 7; hora <= 22; hora++) {
    const horaStr = String(hora).padStart(2, '0');
    listaHorarios.push(`${horaStr}:00`);
    if (hora !== 22) { // Não agenda aula iniciando às 22h30 para terminar pós limite
      listaHorarios.push(`${horaStr}:30`);
    }
  }

  // Preenche início
  listaHorarios.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.innerText = h;
    selectInicio.appendChild(opt);
  });

  // Preenche fim (acrescenta 22h30 e 23h00 como opções de término)
  const listaFinais = [...listaHorarios.slice(1), "22:30", "23:00"];
  listaFinais.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.innerText = h;
    selectFim.appendChild(opt);
  });

  // Default: Início 08:00, Fim 09:00
  selectInicio.value = '08:00';
  selectFim.value = '09:00';
}

/**
 * Controla a digitação no campo de busca do aluno (Autocomplete)
 */
function handleBuscaInput(e) {
  const query = e.target.value;
  
  // Sempre que digitar, se já havia um aluno selecionado, nós desfazemos a seleção para exigir re-validação
  if (inputAlunoId.value) {
    deselecionarAluno();
  }

  clearTimeout(debounceTimeout);
  
  if (query.trim().length < 2) {
    fecharAutocomplete();
    return;
  }

  // Debounce de 200ms para poupar requisições ao servidor
  debounceTimeout = setTimeout(async () => {
    try {
      const professorId = getCurrentProfessorId();
      const resultados = await buscarAlunos(query, professorId);
      renderResultadosAutocomplete(resultados, query);
    } catch (error) {
      console.error('Erro na busca autocomplete:', error);
    }
  }, 200);
}

/**
 * Desenha a caixinha de resultados do autocomplete abaixo do input
 */
function renderResultadosAutocomplete(resultados, query) {
  if (!autocompleteBox) return;
  
  autocompleteBox.innerHTML = '';
  autocompleteBox.classList.remove('hidden');

  if (resultados.length === 0) {
    autocompleteBox.innerHTML = `
      <div class="autocomplete-no-results">
        <span>Nenhum aluno ativo encontrado com "${escapeHTML(query)}"</span>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-cadastro">
          + Cadastrar "${escapeHTML(query)}"
        </button>
      </div>
    `;
    
    // Configura atalho rápido de cadastro de dentro do autocomplete
    const quickCad = document.getElementById('btn-quick-cadastro');
    if (quickCad) {
      quickCad.addEventListener('click', () => {
        fecharAutocomplete();
        fecharModalAgendamento();
        abrirModalAluno();
        // Pré-preenche o campo nome do aluno com o termo pesquisado
        const nomeInput = document.getElementById('aluno-nome');
        if (nomeInput) {
          nomeInput.value = query;
        }
      });
    }
    return;
  }

  resultados.forEach(aluno => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.innerHTML = `
      <div class="aluno-nome">${escapeHTML(aluno.nome)}</div>
      <div class="aluno-meta">CPF: ${escapeHTML(aluno.cpf)} | E-mail: ${escapeHTML(aluno.email)}</div>
    `;
    
    item.addEventListener('click', () => {
      selecionarAluno(aluno);
      fecharAutocomplete();
    });

    autocompleteBox.appendChild(item);
  });
}

function fecharAutocomplete() {
  if (autocompleteBox) {
    autocompleteBox.innerHTML = '';
    autocompleteBox.classList.add('hidden');
  }
}

/**
 * Marca um aluno como devidamente selecionado e validado
 */
function selecionarAluno(aluno) {
  inputAlunoId.value = aluno.id;
  inputBuscaAluno.value = aluno.nome;
  inputBuscaAluno.classList.remove('invalid');
  inputBuscaAluno.readOnly = true; // Impede digitação acidental pós-seleção
  badgeAlunoSelecionado.classList.remove('hidden');
  
  // Adiciona botão/ícone de reset visual ao lado
  inputBuscaAluno.style.paddingRight = '120px';
  
  // Clique no badge limpa a seleção
  badgeAlunoSelecionado.style.cursor = 'pointer';
  badgeAlunoSelecionado.title = 'Clique para trocar de aluno';
  badgeAlunoSelecionado.onclick = deselecionarAluno;
}

/**
 * Remove a seleção do aluno exigindo nova busca
 */
function deselecionarAluno() {
  inputAlunoId.value = '';
  inputBuscaAluno.value = '';
  inputBuscaAluno.readOnly = false;
  badgeAlunoSelecionado.classList.add('hidden');
  inputBuscaAluno.style.paddingRight = '14px';
  limparErrosCampo('err-busca-aluno');
}

/**
 * Trata o envio do formulário de criação de agendamento
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  limparErros();
  globalError.classList.add('hidden');

  const alunoId = inputAlunoId.value;
  const data = inputData.value;
  const disciplina = inputDisciplina.value.trim();
  const horarioInicio = selectInicio.value;
  const horarioFim = selectFim.value;
  const observacoes = inputObs.value.trim();

  let hasError = false;

  // 1. Validação crítica: Garante que um aluno foi selecionado via autocomplete do Banco de Dados
  if (!alunoId) {
    mostrarErroCampo('err-busca-aluno', 'Você DEVE buscar e selecionar um aluno cadastrado no banco.');
    inputBuscaAluno.classList.add('invalid');
    hasError = true;
  }

  if (!data) {
    mostrarErroCampo('err-data', 'Selecione uma data para a aula.');
    inputData.classList.add('invalid');
    hasError = true;
  }

  if (!disciplina) {
    mostrarErroCampo('err-disciplina', 'Digite a disciplina da aula.');
    inputDisciplina.classList.add('invalid');
    hasError = true;
  }

  if (horarioInicio >= horarioFim) {
    mostrarErroCampo('err-fim', 'O horário de término deve ser posterior ao início.');
    selectFim.classList.add('invalid');
    hasError = true;
  }

  if (hasError) return;

  // Envia dados ao Servidor
  btnConfirmar.disabled = true;
  btnConfirmar.innerText = 'Agendando...';

  try {
    const agendamentoCriado = await criarAgendamento({
      alunoId,
      data,
      horarioInicio,
      horarioFim,
      disciplina,
      observacoes
    });

    showToast(`Aula de ${agendamentoCriado.disciplina} agendada para ${agendamentoCriado.aluno.nome}!`, 'success');
    
    // Fecha o modal e limpa
    fecharModalAgendamento();

    // Dispara evento global de atualização dos agendamentos (faz o calendário recarregar dinamicamente)
    const event = new Event('agendamentosAtualizados');
    document.dispatchEvent(event);
  } catch (error) {
    console.error('Erro ao agendar aula:', error);
    // Erros de conflito (409) ou validação no servidor caem aqui
    globalError.innerText = error.message || 'Erro ao realizar agendamento.';
    globalError.classList.remove('hidden');
    
    // Micro-efeito de tremer o modal em caso de erro de conflito
    modalAgendar.querySelector('.modal-box').animate([
      { transform: 'translateX(-10px)' },
      { transform: 'translateX(10px)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(5px)' },
      { transform: 'translateX(0)' }
    ], { duration: 300 });
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.innerText = 'Confirmar Agendamento';
  }
}

/**
 * Limpa o formulário e estados de erro
 */
function limparFormulario() {
  formAgendar.reset();
  deselecionarAluno();
  limparErros();
  globalError.classList.add('hidden');
  popularHorarios();
}

function limparErros() {
  const errors = formAgendar.querySelectorAll('.error-message');
  errors.forEach(err => err.innerText = '');
  
  const inputs = formAgendar.querySelectorAll('input, select, textarea');
  inputs.forEach(input => input.classList.remove('invalid'));
}

function limparErrosCampo(id) {
  const err = document.getElementById(id);
  if (err) err.innerText = '';
}

function mostrarErroCampo(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.innerText = message;
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
