# Como ligar o agendamento online (Supabase)

Leva uns 15 minutos. Tudo pelo navegador.

## 1. Criar o projeto
1. Crie uma conta em https://supabase.com (pode entrar com o GitHub ou o Google).
2. Clique em **New project**.
   - **Name:** styllo-barbearia
   - **Database Password:** crie uma senha forte e guarde num lugar seguro.
   - **Region:** South America (São Paulo)
3. Espere o projeto terminar de ser criado (1 a 2 minutos).

## 2. Criar o banco de dados
1. No menu lateral, abra **SQL Editor** e clique em **New query**.
2. Abra o arquivo `supabase/schema.sql`, copie **todo** o conteúdo, cole no editor e clique em **Run**.
3. Deve aparecer "Success. No rows returned".
   Rode esse arquivo **uma vez só**. Se rodar de novo, ele dá erro porque as tabelas já existem.

## 2.1 Atualizações do banco
Rode também, **em ordem**, os arquivos da pasta `supabase/migracoes/` (SQL Editor > New query > colar > Run):
- `002_fotos_barbeiros.sql`: cria o espaço para as fotos dos barbeiros.

Esses arquivos podem ser rodados mais de uma vez sem problema.

## 3. Conectar o site
1. Abra **Project Settings > API**.
2. Copie a **Project URL** e a chave **anon public**.
3. No arquivo `config.js`, cole cada uma no lugar certo:
   ```js
   supabaseUrl: "https://xxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJhbGciOi...",
   ```
   **Nunca** use a chave `service_role` no site.

## 4. Criar a conta do dono
1. Em **Authentication > Users**, clique em **Add user > Create new user**.
   Informe o e-mail e a senha do dono e marque **Auto Confirm User**.
2. Volte ao **SQL Editor** e rode (trocando pelo e-mail usado):
   ```sql
   update perfis set papel = 'dono', nome = 'Seu nome' where email = 'seu-email@exemplo.com';
   ```
3. Pronto. Entre no painel em `seudominio.com.br/admin` (ou `admin/index.html`).

A partir daí, **todo o resto é feito pelo painel**:
- **Equipe**: cadastre os barbeiros (nome e especialidade). Sem barbeiro ativo, o agendamento online não abre.
- **Equipe > Acessos**: libere o login dos barbeiros (as contas são criadas como no passo 1, sem o SQL).
- **Serviços**: os 32 serviços já vêm cadastrados com preço e duração. Edite quando quiser.
- **Ajustes**: horário de funcionamento, intervalo entre horários, antecedência mínima.

## 5. Bloquear cadastros de estranhos
Em **Authentication > Sign In / Providers > Email**, desligue **Allow new users to sign up**.
Assim, só quem você criar no passo 4 consegue ter conta.

## 6. Endereço do site (para o "Esqueci minha senha")
Depois de publicar o site, em **Authentication > URL Configuration**:
- **Site URL**: `https://seudominio.com.br`
- **Redirect URLs**: adicione `https://seudominio.com.br/admin/`

## 7. Testar
Abra `agendar.html` e faça um agendamento. Ele aparece na **Agenda** do painel.
O link "Ver meu agendamento" leva para `cancelar.html`, onde o cliente consulta ou cancela o horário.

## Regras que o banco garante
- Só mostra horários dentro do funcionamento (Seg–Sex 9h–19h, Sáb 8h–18h, Dom fechado),
  considerando a duração do serviço e a antecedência mínima de 60 minutos.
- Dois clientes nunca ficam com o mesmo barbeiro no mesmo horário, mesmo se clicarem ao mesmo tempo.
- "Sem preferência" escolhe o barbeiro livre com menos atendimentos no dia.
- No máximo 3 agendamentos em aberto por telefone.
- Visitantes não conseguem ver agendamentos, clientes, comissões nem o financeiro.

Tudo isso também pode ser mudado pelo painel, em **Ajustes**.
