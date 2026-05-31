import { getAgendamentos, cancelarAgendamento } from './api.js';
import { showToast, getCurrentRole, getCurrentStudent, getCurrentProfessorId } from './app.js';

// Nomes dos meses em português
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Estado do Calendário
let dataAtual = new Date(); // Mês e ano em exibição
let diaSelecionado = new Date(); // Dia ativo
let agendamentosMes = []; // Cache de agendamentos do mês em exibição

// Elementos DOM
const calendarMonthYear = document.getElementById('calendar-month-year');
const calendarDaysContainer = document.getElementById('calendar-days-container');
const btnPrevMonth = document.getElementById('cal-prev-month');
const btnNextMonth = document.getElementById('cal-next-month');

const selectedDayTitle = document.getElementById('selected-day-title');
const selectedDaySubtitle = document.getElementById('selected-day-subtitle');
const dayAgendaList = document.getElementById('day-agenda-list');

/**
 * Inicializa o Calendário e a listagem diária
 */
export async function initCalendar() {
  setupEventListeners();
  await carregarMesAtual();
}

/**
 * Configura eventos de navegação e cliques
 */
function setupEventListeners() {
  if (btnPrevMonth) {
    btnPrevMonth.addEventListener('click', () => navegarMes(-1));
  }
  if (btnNextMonth) {
    btnNextMonth.addEventListener('click', () => navegarMes(1));
  }
  
  // Escuta evento global de atualização para atualizar o calendário
  document.addEventListener('agendamentosAtualizados', async () => {
    await carregarMesAtual();
  });
}

/**
 * Retorna o dia selecionado atualmente (útil para pré-preencher o formulário de agendamento)
 * Formato: YYYY-MM-DD
 */
export function getDiaSelecionadoFormatado() {
  const y = diaSelecionado.getFullYear();
  const m = String(diaSelecionado.getMonth() + 1).padStart(2, '0');
  const d = String(diaSelecionado.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Navega entre os meses
 * @param {number} direcao -1 para anterior, 1 para próximo
 */
async function navegarMes(direcao) {
  dataAtual.setMonth(dataAtual.getMonth() + direcao);
  await carregarMesAtual();
}

/**
 * Carrega os agendamentos do mês atual e renderiza o calendário
 */
export async function carregarMesAtual() {
  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();

  // Define os limites do mês para puxar da API
  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);

  const dataDe = formatarDataISO(primeiroDiaMes);
  const dataAte = formatarDataISO(ultimoDiaMes);

  // Define o cabeçalho do mês
  if (calendarMonthYear) {
    calendarMonthYear.innerText = `${MESES[mes]} ${ano}`;
  }

  try {
    const role = getCurrentRole();
    const student = getCurrentStudent();
    const professorId = getCurrentProfessorId();
    const filtros = { de: dataDe, ate: dataAte };

    if (role === 'aluno' && student) {
      filtros.alunoId = student.id;
    } else if (professorId) {
      filtros.professorId = professorId;
    }

    // Puxa apenas os agendamentos do período visualizado para performance otimizada
    agendamentosMes = await getAgendamentos(filtros);
    
    renderizarDias();
    renderizarDetalhesDia();
  } catch (error) {
    console.error('Erro ao carregar agenda:', error);
    showToast('Erro ao carregar compromissos da agenda.', 'error');
  }
}

/**
 * Desenha os quadradinhos/círculos de dias do calendário
 */
function renderizarDias() {
  if (!calendarDaysContainer) return;
  calendarDaysContainer.innerHTML = '';

  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();

  // Quantidade de dias no mês
  const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();
  
  // Dia da semana do primeiro dia do mês (0 = Domingo, 1 = Segunda, etc.)
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();

  // 1. Renderiza dias vazios do mês anterior para alinhamento da grade semanal
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    calendarDaysContainer.appendChild(emptyCell);
  }

  // 2. Renderiza os dias reais do mês
  const hoje = new Date();
  
  for (let dia = 1; dia <= totalDiasNoMes; dia++) {
    const diaDate = new Date(ano, mes, dia);
    const diaStr = formatarDataISO(diaDate);

    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    dayCell.innerText = dia;

    // Checa se é "hoje"
    if (diaDate.getDate() === hoje.getDate() && 
        diaDate.getMonth() === hoje.getMonth() && 
        diaDate.getFullYear() === hoje.getFullYear()) {
      dayCell.classList.add('today');
    }

    // Checa se está selecionado
    if (diaDate.getDate() === diaSelecionado.getDate() && 
        diaDate.getMonth() === diaSelecionado.getMonth() && 
        diaDate.getFullYear() === diaSelecionado.getFullYear()) {
      dayCell.classList.add('selected');
    }

    // Checa se tem alguma aula agendada nesse dia (para desenhar o pontinho roxo)
    const temAula = agendamentosMes.some(ag => ag.data === diaStr);
    if (temAula) {
      const dot = document.createElement('div');
      dot.className = 'event-dot';
      dayCell.appendChild(dot);
    }

    // Evento de clique para selecionar o dia
    dayCell.addEventListener('click', () => {
      diaSelecionado = diaDate;
      
      // Atualiza classes selecionadas nos elementos irmãos
      const activeDays = calendarDaysContainer.querySelectorAll('.calendar-day.selected');
      activeDays.forEach(d => d.classList.remove('selected'));
      dayCell.classList.add('selected');

      renderizarDetalhesDia();
    });

    calendarDaysContainer.appendChild(dayCell);
  }
}

/**
 * Renderiza a lista de aulas detalhada na coluna da direita para o dia selecionado
 */
export function renderizarDetalhesDia() {
  if (!dayAgendaList) return;
  
  const diaStr = formatarDataISO(diaSelecionado);
  
  // Titulos do painel lateral
  if (selectedDayTitle) {
    const hoje = new Date();
    if (diaStr === formatarDataISO(hoje)) {
      selectedDayTitle.innerText = 'Aulas de Hoje';
    } else {
      selectedDayTitle.innerText = 'Aulas do Dia';
    }
  }

  if (selectedDaySubtitle) {
    selectedDaySubtitle.innerText = formatarDataPorExtenso(diaSelecionado);
  }

  // Filtra agendamentos apenas do dia selecionado
  const aulasDoDia = agendamentosMes.filter(ag => ag.data === diaStr);

  if (aulasDoDia.length === 0) {
    dayAgendaList.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); margin-bottom: 12px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <p>Nenhuma aula reservada para este dia.</p>
      </div>
    `;
    return;
  }

  dayAgendaList.innerHTML = aulasDoDia.map(aula => {
    const alunoNome = aula.aluno ? aula.aluno.nome : 'Aluno Excluído';
    const alunoEmail = aula.aluno ? aula.aluno.email : '';
    const alunoTel = aula.aluno ? aula.aluno.telefone : '';
    const observacoesHtml = aula.observacoes 
      ? `<div class="class-notes"><strong>Obs:</strong> ${escapeHTML(aula.observacoes)}</div>` 
      : '';

    return `
      <div class="class-item" id="class-item-${aula.id}">
        <div class="class-time-block">
          <span class="class-time-start">${aula.horarioInicio}</span>
          <span class="class-time-end">${aula.horarioFim}</span>
        </div>
        <div class="class-details">
          <h4 class="class-subject">${escapeHTML(aula.disciplina)}</h4>
          <div class="class-student">
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <strong>${escapeHTML(alunoNome)}</strong>
            </span>
            ${alunoEmail ? `<span style="font-size: 11px; opacity: 0.8;">✉ ${escapeHTML(alunoEmail)}</span>` : ''}
            ${alunoTel ? `<span style="font-size: 11px; opacity: 0.8;">📞 ${escapeHTML(alunoTel)}</span>` : ''}
          </div>
          ${observacoesHtml}
        </div>
        <button class="btn-cancel-class" title="Desmarcar Aula" onclick="window.cancelarAula('${aula.id}', '${escapeHTML(alunoNome)}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
  }).join('');
}

/**
 * Cancela uma aula confirmando com o usuário
 */
window.cancelarAula = async function(id, alunoNome) {
  if (confirm(`Deseja realmente cancelar o agendamento de aula para ${alunoNome}?`)) {
    try {
      const response = await cancelarAgendamento(id);
      showToast(response.message || 'Agendamento cancelado com sucesso.', 'success');
      
      // Força a atualização do calendário e re-renderiza
      await carregarMesAtual();
      
      // Dispara evento global para o dashboard atualizar
      const event = new Event('agendamentosAtualizados');
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      showToast(error.message || 'Erro ao cancelar a aula.', 'error');
    }
  }
};

// ==========================================
// FUNÇÕES AUXILIARES DE FORMATO
// ==========================================

function formatarDataISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarDataPorExtenso(date) {
  const dia = date.getDate();
  const ano = date.getFullYear();
  const mes = MESES[date.getMonth()];
  return `${dia} de ${mes} de ${ano}`;
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
