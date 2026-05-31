const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de Logs no Terminal
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Middleware para JSON e arquivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota: Portal do Aluno com slug do professor
app.get('/aluno/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'aluno', 'index.html'));
});

// Rota: Portal do Aluno sem slug (redireciona para info)
app.get('/aluno', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'aluno', 'index.html'));
});

// Caminhos dos arquivos de banco de dados
const ALUNOS_FILE       = path.join(__dirname, 'data', 'alunos.json');
const AGENDAMENTOS_FILE = path.join(__dirname, 'data', 'agendamentos.json');
const PROFESSORES_FILE  = path.join(__dirname, 'data', 'professores.json');

// Auxiliares para ler/escrever arquivos com tratamento de erro e Retry (OneDrive Safe)
async function lerBanco(filePath) {
  const maxRetries = 5;
  let delay = 50;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data || '[]');
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          await fs.writeFile(filePath, '[]');
          return [];
        } catch (e) {
          // Se falhar ao criar o arquivo, tenta novamente no loop
        }
      }
      
      const isLocked = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES';
      if (isLocked && i < maxRetries - 1) {
        console.warn(`[AVISO] Leitura bloqueada em ${filePath}. Tentando novamente em ${delay}ms... (Tentativa ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        console.error(`Erro ao ler arquivo ${filePath}:`, error);
        return [];
      }
    }
  }
  return [];
}

async function escreverBanco(filePath, data) {
  const maxRetries = 5;
  let delay = 100;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return; // Sucesso!
    } catch (error) {
      const isLocked = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES';
      if (isLocked && i < maxRetries - 1) {
        console.warn(`[AVISO] Gravação bloqueada em ${filePath}. Tentando novamente em ${delay}ms... (Tentativa ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Backoff exponencial
      } else {
        console.error(`Erro ao escrever no arquivo ${filePath}:`, error);
        throw new Error(`Falha na gravação do banco de dados: ${error.message}`);
      }
    }
  }
}

// Gera slug URL-amigável a partir de uma string
function gerarSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ==========================================
// ROTAS DE PROFESSORES
// ==========================================

// Cadastrar novo professor
app.post('/api/professores/registro', async (req, res) => {
  try {
    const { nome, email, senha, slug } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, E-mail e Senha são obrigatórios.' });
    }

    const professores = await lerBanco(PROFESSORES_FILE);

    const emailNorm = email.toLowerCase().trim();
    if (professores.find(p => p.email === emailNorm)) {
      return res.status(400).json({ error: 'Já existe um professor cadastrado com este E-mail.' });
    }

    // Gera slug: usa o fornecido ou gera a partir do nome
    let slugFinal = slug ? gerarSlug(slug) : gerarSlug(nome);
    // Garante unicidade: se já existe, adiciona sufixo numérico
    let slugBase = slugFinal;
    let contador = 2;
    while (professores.find(p => p.slug === slugFinal)) {
      slugFinal = `${slugBase}-${contador}`;
      contador++;
    }

    const novoProfessor = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      email: emailNorm,
      senha: senha,
      slug: slugFinal,
      dataCadastro: new Date().toISOString()
    };

    professores.push(novoProfessor);
    await escreverBanco(PROFESSORES_FILE, professores);

    // Se é o primeiro professor, adota os alunos órfãos (sem professorId)
    if (professores.length === 1) {
      const alunos = await lerBanco(ALUNOS_FILE);
      const alunosAtualizados = alunos.map(a =>
        a.professorId ? a : { ...a, professorId: novoProfessor.id }
      );
      await escreverBanco(ALUNOS_FILE, alunosAtualizados);
    }

    const { senha: _, ...professorPublico } = novoProfessor;
    res.status(201).json(professorPublico);
  } catch (error) {
    console.error('Erro no registro do professor:', error);
    res.status(500).json({ error: `Erro interno ao cadastrar professor: ${error.message}` });
  }
});

// Login do professor (email + senha)
app.post('/api/professores/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e Senha são obrigatórios.' });
    }

    const professores = await lerBanco(PROFESSORES_FILE);
    const professor = professores.find(p =>
      p.email === email.toLowerCase().trim() && p.senha === senha
    );

    if (!professor) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const { senha: _, ...professorPublico } = professor;
    res.json(professorPublico);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
});

// Buscar professor pelo slug (para o portal do aluno)
app.get('/api/professores/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const professores = await lerBanco(PROFESSORES_FILE);
    const professor = professores.find(p => p.slug === slug.toLowerCase());

    if (!professor) {
      return res.status(404).json({ error: 'Link inválido. Verifique com seu professor.' });
    }

    // Retorna apenas dados públicos
    res.json({ id: professor.id, nome: professor.nome, slug: professor.slug });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ==========================================
// ROTAS DE ALUNOS
// ==========================================

// Listar alunos (filtrado por professorId)
app.get('/api/alunos', async (req, res) => {
  try {
    const { professorId } = req.query;
    const alunos = await lerBanco(ALUNOS_FILE);
    const filtrados = professorId
      ? alunos.filter(a => a.professorId === professorId)
      : alunos;
    res.json(filtrados);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao carregar alunos.' });
  }
});

// Login do aluno pelo Portal: busca por CPF ou E-mail (filtrado por professorId)
app.get('/api/alunos/login', async (req, res) => {
  try {
    const { q, professorId } = req.query;
    if (!q || q.trim().length < 3) {
      return res.status(400).json({ error: 'Digite pelo menos 3 caracteres do CPF ou E-mail.' });
    }

    const query = q.toLowerCase().trim();
    const alunos = await lerBanco(ALUNOS_FILE);

    // Filtra pelo professor se informado
    const pool = professorId ? alunos.filter(a => a.professorId === professorId) : alunos;

    const cpfQuery = query.replace(/\D/g, '');
    const aluno = pool.find(a => {
      const cpfMatch = cpfQuery.length >= 6 && a.cpf.replace(/\D/g, '') === cpfQuery;
      const emailMatch = a.email.toLowerCase().trim() === query;
      return (cpfMatch || emailMatch) && a.status === 'ativo';
    });

    if (!aluno) {
      return res.status(404).json({ error: 'Nenhum aluno ativo encontrado com este CPF ou E-mail. Verifique seus dados ou crie uma conta.' });
    }

    res.json(aluno);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

// Busca/Autocomplete de alunos (filtrado por professorId)
app.get('/api/alunos/busca', async (req, res) => {
  try {
    const { q, professorId } = req.query;
    if (!q) return res.json([]);

    const query = q.toLowerCase().trim();
    const alunos = await lerBanco(ALUNOS_FILE);

    const pool = professorId ? alunos.filter(a => a.professorId === professorId) : alunos;

    const filtrados = pool.filter(aluno =>
      aluno.status === 'ativo' && (
        aluno.nome.toLowerCase().includes(query) ||
        aluno.cpf.replace(/\D/g, '').includes(query.replace(/\D/g, '')) ||
        aluno.email.toLowerCase().includes(query)
      )
    );

    res.json(filtrados);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar alunos.' });
  }
});

// Cadastrar novo aluno (vinculado a um professor)
app.post('/api/alunos', async (req, res) => {
  try {
    const { nome, email, telefone, cpf, professorId } = req.body;

    if (!nome || !email || !telefone || !cpf) {
      return res.status(400).json({ error: 'Todos os campos (Nome, E-mail, Telefone e CPF) são obrigatórios.' });
    }

    const alunos = await lerBanco(ALUNOS_FILE);

    const cpfNormalizado  = cpf.replace(/\D/g, '');
    const emailNormalizado = email.toLowerCase().trim();

    // Verifica duplicatas (global, independente de professor)
    const cpfDuplicado   = alunos.find(a => a.cpf.replace(/\D/g, '') === cpfNormalizado);
    const emailDuplicado = alunos.find(a => a.email.toLowerCase().trim() === emailNormalizado);

    if (cpfDuplicado)   return res.status(400).json({ error: 'Já existe um aluno cadastrado com este CPF.' });
    if (emailDuplicado) return res.status(400).json({ error: 'Já existe um aluno cadastrado com este E-mail.' });

    const novoAluno = {
      id: crypto.randomUUID(),
      professorId: professorId || null,
      nome: nome.trim(),
      email: emailNormalizado,
      telefone: telefone.trim(),
      cpf: cpf.trim(),
      dataCadastro: new Date().toISOString(),
      status: 'ativo'
    };

    alunos.push(novoAluno);
    await escreverBanco(ALUNOS_FILE, alunos);

    res.status(201).json(novoAluno);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao cadastrar aluno.' });
  }
});

// ==========================================
// ROTAS DE AGENDAMENTOS
// ==========================================

// Listar agendamentos (filtrado por professorId, alunoId, data ou período)
app.get('/api/agendamentos', async (req, res) => {
  try {
    const agendamentos  = await lerBanco(AGENDAMENTOS_FILE);
    const alunos        = await lerBanco(ALUNOS_FILE);
    const { data, de, ate, alunoId, professorId } = req.query;

    // Pré-calcula os IDs de alunos permitidos para o professor
    let alunoIdsPermitidos = null;
    if (professorId) {
      const alunosDoProfessor = alunos.filter(a => a.professorId === professorId);
      alunoIdsPermitidos = new Set(alunosDoProfessor.map(a => a.id));
    }

    // Popula dados do aluno em cada agendamento
    const agendamentosPopulados = agendamentos.map(agenda => {
      const aluno = alunos.find(a => a.id === agenda.alunoId);
      return {
        ...agenda,
        aluno: aluno ? { nome: aluno.nome, email: aluno.email, telefone: aluno.telefone } : null
      };
    });

    let filtrados = agendamentosPopulados;

    // Filtro por professor (via alunos do professor)
    if (alunoIdsPermitidos) {
      filtrados = filtrados.filter(a => alunoIdsPermitidos.has(a.alunoId));
    }

    if (alunoId) {
      filtrados = filtrados.filter(a => a.alunoId === alunoId);
    }

    if (data) {
      filtrados = filtrados.filter(a => a.data === data);
    } else if (de && ate) {
      filtrados = filtrados.filter(a => a.data >= de && a.data <= ate);
    }

    filtrados.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.horarioInicio.localeCompare(b.horarioInicio);
    });

    res.json(filtrados);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar agendamentos.' });
  }
});

// Criar novo agendamento
app.post('/api/agendamentos', async (req, res) => {
  try {
    const { alunoId, data, horarioInicio, horarioFim, disciplina, observacoes } = req.body;

    if (!alunoId || !data || !horarioInicio || !horarioFim || !disciplina) {
      return res.status(400).json({ error: 'Aluno, Data, Horário de Início, Fim e Disciplina são obrigatórios.' });
    }

    if (horarioInicio >= horarioFim) {
      return res.status(400).json({ error: 'O horário de início deve ser anterior ao horário de término.' });
    }

    const alunos = await lerBanco(ALUNOS_FILE);
    const aluno  = alunos.find(a => a.id === alunoId);

    if (!aluno)                    return res.status(400).json({ error: 'Aluno não encontrado no banco de dados.' });
    if (aluno.status !== 'ativo') return res.status(400).json({ error: 'Este aluno está inativo e não pode realizar agendamentos.' });

    const agendamentos = await lerBanco(AGENDAMENTOS_FILE);

    const conflito = agendamentos.find(ag =>
      ag.data === data &&
      horarioInicio < ag.horarioFim &&
      horarioFim > ag.horarioInicio
    );

    if (conflito) {
      const alunoConflito = alunos.find(a => a.id === conflito.alunoId);
      const nomeConflito  = alunoConflito ? alunoConflito.nome : 'Outro Aluno';
      return res.status(409).json({
        error: `Conflito de Horário! Já existe uma aula de "${conflito.disciplina}" reservada para ${nomeConflito} das ${conflito.horarioInicio} às ${conflito.horarioFim} nesta data.`
      });
    }

    const novoAgendamento = {
      id: crypto.randomUUID(),
      alunoId,
      data,
      horarioInicio,
      horarioFim,
      disciplina: disciplina.trim(),
      observacoes: (observacoes || '').trim(),
      dataCriacao: new Date().toISOString()
    };

    agendamentos.push(novoAgendamento);
    await escreverBanco(AGENDAMENTOS_FILE, agendamentos);

    res.status(201).json({
      ...novoAgendamento,
      aluno: { nome: aluno.nome, email: aluno.email, telefone: aluno.telefone }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao criar agendamento.' });
  }
});

// Cancelar/Deletar agendamento
app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agendamentos = await lerBanco(AGENDAMENTOS_FILE);

    const index = agendamentos.findIndex(ag => ag.id === id);
    if (index === -1) return res.status(404).json({ error: 'Agendamento não encontrado.' });

    agendamentos.splice(index, 1);
    await escreverBanco(AGENDAMENTOS_FILE, agendamentos);

    res.json({ message: 'Agendamento cancelado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao cancelar agendamento.' });
  }
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
