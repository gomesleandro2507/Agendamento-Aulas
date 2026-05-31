# Links Hub - Sistema de Agendamento de Aulas com Múltiplos Perfis

Uma plataforma web moderna, rápida e responsiva para **Agendamento de Aulas**, totalmente integrada a um gerenciador de banco de dados de **Alunos**. O sistema garante segurança ao segmentar a interface em dois níveis de acesso: o **Portal do Aluno** e o **Portal do Professor (Master)**, com controle inteligente de convergência e isolamento de agendas.

---

## ✨ Características Principais

*   **Design Premium & Responsivo**: Interface com efeito *Glassmorphism* moderno, micro-animações fluidas de clique e transições de tela, otimizado para celulares, tablets e computadores.
*   **Tema Duplo Dinâmico**: Alternância suave entre **Tema Escuro (Deep Neon Dark)** e **Tema Claro (Slate Premium)** com persistência da preferência no navegador (`localStorage`).
*   **Múltiplos Níveis de Acesso (Destaque)**:
    *   **Portal do Professor / Master (Visão Consolidada)**: Visualiza estatísticas da escola inteira, gerencia o banco de dados completo de alunos e tem acesso à **Agenda Master**, onde **todas** as aulas de todos os alunos convergem em uma única linha do tempo consolidada. Possui poder exclusivo para cancelar agendamentos.
    *   **Portal do Aluno (Visão Isolada & Segura)**: Uma vez conectado em sua sessão (simulada por um seletor visual reativo), as abas administrativas do aluno são ocultadas. O aluno vê apenas o seu painel de estatísticas próprio e a sua **Agenda Pessoal**, ficando totalmente cego para as aulas marcadas por outros alunos.
*   **Agendamento Simplificado para o Aluno**: No perfil de Aluno, o formulário de reserva trava automaticamente os dados com as informações do aluno logado, prevenindo agendamentos avulsos ou errôneos.
*   **Controle Inteligente de Conflitos**: O backend analisa sobreposição de horas em tempo real. Se o horário solicitado conflitar com outra aula já agendada na mesma data, a reserva é bloqueada e um aviso visual explicativo é fornecido.
*   **Calendário Interativo**: Calendário customizado desenvolvido em JavaScript puro com marcação visual dos dias que contêm aulas (pontos discretos) e exibição das aulas detalhadas do dia selecionado.
*   **Banco de Dados Integrado**: Sistema robusto baseado em arquivos JSON (`data/alunos.json` e `data/agendamentos.json`) estruturado com travas de integridade no servidor Express.

---

## 🛠️ Tecnologias Utilizadas

*   **Frontend**: HTML5 Semântico, CSS3 Custom Properties (Variáveis de estilo, Flexbox, CSS Grid) e JavaScript Moderno (ES Modules).
*   **Backend**: Node.js com Express para criação de rotas REST.
*   **Persistência**: Arquivos estruturados em formato JSON gerenciados por serviço com tratamento assíncrono nativo (`fs/promises`).

---

## 🚀 Como Executar o Projeto

Como o projeto utiliza banco de dados portátil em arquivos locais, a inicialização é extremamente rápida e sem burocracias de configuração de servidores de banco adicionais.

### Pré-requisitos
Ter o **Node.js** instalado na sua máquina (recomendado v16 ou superior).

### Passo a Passo

1. **Instalar Dependências**:
   No diretório do projeto, execute o comando abaixo para instalar as bibliotecas do servidor (Express):
   *   **Se estiver no PowerShell do Windows**:
       ```powershell
       npm.cmd install
       ```
   *   **Se estiver no Prompt de Comando (CMD) ou outro terminal**:
       ```bash
       npm install
       ```

2. **Iniciar o Servidor**:
   Execute o seguinte comando para ligar o servidor Express local:
   ```bash
   npm start
   ```

3. **Acessar a Aplicação**:
   Abra o seu navegador web favorito e digite o endereço:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📁 Estrutura de Diretórios do Projeto

*   `data/`: Contém os bancos de dados portáteis `alunos.json` e `agendamentos.json`.
*   `public/`: Código-fonte da aplicação frontend (SPA).
    *   `index.html`: Casca principal da Single Page Application com layouts e modais.
    *   `css/style.css`: Estilizações visuais, design system, animações e regras de temas claros/escuros.
    *   `js/`: Módulos de comportamento em JavaScript moderno.
        *   `app.js`: Orquestrador geral, controle de perfis de acesso, simulador de login e toasts.
        *   `api.js`: Comunicação fetch centralizada com o backend.
        *   `students.js`: Gerenciamento, máscaras e validação do cadastro de alunos.
        *   `calendar.js`: Regras de renderização e interações com o calendário (filtrado por perfil).
        *   `booking.js`: Formulário de agendamento travado para Aluno ou flexível para Professor.
*   `server.js`: Servidor Express com a API REST de Alunos e Agendamentos.
*   `package.json`: Configurações de dependências do Node.js.
