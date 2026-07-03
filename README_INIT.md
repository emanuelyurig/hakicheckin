# 🥋 Haki Presença - Sistema de Confirmação de Presença de Jiu-Jitsu

Uma plataforma moderna, elegante e em tempo real desenvolvida para academias de Jiu-Jitsu gerenciarem a presença de atletas em suas aulas diárias de forma simplificada, sem fricção de logins ou autenticações.

O sistema opera de forma inteligente em dois modos:
1. **Modo Supabase Cloud**: Conectado à sua nuvem em tempo real de produção.
2. **Modo Simulador Local (Fallback)**: Funciona imediatamente usando `localStorage` e canais de transmissão internos, ideal para testes instantâneos e visualização sem dependências externas!

---

## 🚀 Funcionalidades Principal

- **Área do Aluno (Simplicidade Absoluta)**: O aluno apenas acessa o link enviado via WhatsApp, preenche seu nome completo e confirma presença com um clique.
- **Validação Sênior de Nomes**: Tratamento automático de espaços extras, validação de nome em branco, e checagem case-insensitive para prevenir nomes duplicados na mesma aula.
- **Painel Administrativo Realtime**: Monitoramento de confirmados em tempo real (utilizando canais de Realtime do Supabase), configuração rápida da aula ativa do dia e acompanhamento estatístico da capacidade de vagas.
- **Gestão de Presenças**: Opção de remover atletas da lista (liberando a vaga imediatamente) e limpar toda a chamada mantendo os dados de configuração da aula diária intactos.
- **Exportação de Dados**:
  - 📊 **Excel**: Exportação instantânea em formato `.csv` otimizado para o Microsoft Excel (com delimitador `;` e UTF-8 BOM para acentuação perfeita).
  - 📄 **PDF / Impressão**: Layout customizado inteligente (utilizando regras CSS `@media print`) que gera uma folha de chamada profissional, pronta para ser impressa ou salva em formato PDF.

---

## 🛠️ Tecnologias Utilizadas

- **Vite + React (v19)** com **TypeScript**
- **Tailwind CSS** para estilização moderna e design focado no tema Jiu-Jitsu (Preto, Branco e Vermelho)
- **Supabase** (Banco de Dados Postgres + Realtime API)
- **TanStack React Query** para cache e sincronização otimizada de dados
- **React Hook Form + Zod** para validação robusta de formulários e estados
- **Motion** para micro-animações fluidas e elegantes

---

## 💾 Configuração do Banco de Dados (Supabase)

Para conectar o projeto ao seu próprio projeto do Supabase, copie e execute o script SQL contido no arquivo `supabase_schema.sql` diretamente no **SQL Editor** do painel do seu projeto Supabase. 

Esse script irá criar:
1. A tabela `aulas` com identificador UUID único.
2. A tabela `presencas` com integridade referencial `ON DELETE CASCADE` conectada à tabela de aulas.
3. Um índice único case-insensitive (`unique_aula_nome_lower_idx`) no nível de banco de dados para impedir nomes duplicados de forma intransigente.
4. Políticas de Segurança (RLS - Row Level Security) adequadas para inserções e leituras anônimas públicas.
5. Inclusão das tabelas no sistema de publicação **Realtime** do Supabase para sincronização instantânea sem recarregar páginas.

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do seu projeto (ou configure as variáveis nas configurações da sua hospedagem na Vercel/Cloud Run) com as seguintes credenciais:

```env
VITE_SUPABASE_URL="https://seu-projeto-supabase.supabase.co"
VITE_SUPABASE_ANON_KEY="sua-chave-anon-publica-do-supabase"
```

*Nota: Se estas chaves não forem definidas ou contiverem valores de exemplo, o sistema ativará automaticamente o **Modo Simulador Local** em tempo real usando `localStorage`, permitindo que você navegue e teste a aplicação instantaneamente.*

---

## 💻 Como Executar Localmente

Siga o passo a passo abaixo para rodar o projeto na sua máquina de desenvolvimento:

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Iniciar Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```

3. **Acessar o Projeto**:
   Abra [http://localhost:3000](http://localhost:3000) no seu navegador.
   - **Área do Aluno**: `http://localhost:3000/#/`
   - **Painel Administrativo**: `http://localhost:3000/#/admin`

---

## ☁️ Como Fazer Deploy na Vercel

A aplicação está configurada e 100% pronta para deploy imediato na Vercel:

1. **Repositório**: Envie o código do seu projeto para um repositório no GitHub, GitLab ou Bitbucket.
2. **Novo Projeto**: Acesse o painel da [Vercel](https://vercel.com) e importe o repositório do projeto.
3. **Configuração**:
   - **Framework Preset**: Selecione `Vite`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Variáveis de Ambiente**:
   Adicione as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com as chaves correspondentes do seu projeto Supabase.
5. **Deploy**: Clique em **Deploy**! A Vercel cuidará de compilar e publicar seu site em poucos segundos.

---
**OSS!** Que os treinos continuem produtivos e organizados. 🥋
"# hakicheckin" 
