# Painel de Clientes

Painel para gerenciar os sites dos clientes e **impedir que os projetos Supabase free sejam pausados**.
O Supabase pausa projetos free depois de 7 dias sem atividade. Este painel faz uma consulta real no banco de cada
cliente **todo dia** pela Vercel Cron. O próprio banco do painel também recebe atividade, então ele não pausa.

## O que tem
- Lista de clientes com status (Saudável / Atenção / Risco de pausa), dias até a pausa e site no ar ou fora
- Ping automático diário, botão "Pingar agora" (por cliente ou todos) e histórico dos últimos 90 dias
- Mensalidade de cada cliente, receita mensal total, observações e link direto para o dashboard Supabase de cada um
- Login com Supabase Auth, restrito aos e-mails em `ALLOWED_EMAILS`

## Configuração (uma vez)

### 1. Projeto Supabase do painel
1. Crie um projeto novo no Supabase (free) só para o painel.
2. **SQL Editor**: cole e rode `supabase/schema.sql`.
3. **Authentication → Users → Add user**: crie seu usuário com e-mail e senha (marque *Auto Confirm*).
4. **Authentication → Sign In / Providers**: desative *Allow new users to sign up*.
5. Em **Project Settings → API**, copie a URL, a anon/publishable key e a service_role/secret key.

### 2. Rodar localmente
```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy na Vercel (grátis)
1. Suba a pasta para um repositório no GitHub e importe na Vercel.
2. Em **Settings → Environment Variables**, cadastre todas as variáveis do `.env.example`.
   O `CRON_SECRET` pode ser qualquer string longa aleatória.
3. Faça o deploy. O `vercel.json` já agenda o cron em `/api/cron` todo dia às 11:00 UTC (08:00 em Brasília).
   Confira em **Settings → Cron Jobs**.

> O cron precisa rodar na nuvem. Se o painel rodar só no seu PC, nada impede a pausa quando o PC estiver desligado.

### 4. Para cada cliente
1. No Supabase do cliente, rode `supabase/keep_alive_cliente.sql` no SQL Editor. Ele cria uma tabelinha `keep_alive`
   com leitura pública e nenhum dado sensível. A página do cliente no painel tem o SQL e um botão de copiar.
2. No painel, clique em **+ Novo cliente** e cole a Project URL e a **anon/publishable** key (nunca a service_role).
3. Ao salvar, o painel já testa a conexão. Se aparecer "tabela não existe", falta o passo 1.

### 4b. Importação automática (clientes em várias contas Supabase)
Em vez do passo 4 manual:
1. Em cada conta Supabase, gere um token em https://supabase.com/dashboard/account/tokens.
2. Crie `tokens.local.txt` na raiz (já está no `.gitignore`), um por linha: `Rótulo da conta = sbp_...`
3. `npm run importar` faz uma **simulação**: lista os projetos de todas as contas sem alterar nada.
4. `npm run importar -- --aplicar --ignorar ref1,ref2` cria a tabela `keep_alive` em cada projeto, busca a chave
   pública e cadastra no painel. Use `--ignorar` para pular projetos que não são de clientes.
   Com `--restaurar`, também pede a restauração dos projetos pausados.
5. **Apague o `tokens.local.txt` e revogue os tokens.** O painel não precisa deles.

## Testar o cron manualmente
```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://seu-painel.vercel.app/api/cron
```

## Se um projeto já foi pausado
O ping não reativa um projeto pausado. Restaure no dashboard do Supabase (o painel tem o link direto).
Depois disso, o ping diário mantém o projeto ativo.
