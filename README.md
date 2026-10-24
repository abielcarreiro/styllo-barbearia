# Navalha Nobre Barbearia

Site da Navalha Nobre Barbearia (Patos - PB) com agendamento online e painel administrativo.

- **Site:** HTML, CSS e JavaScript puros (sem framework)
- **Banco e login:** [Supabase](https://supabase.com) — esquema em `supabase/schema.sql`
- **Hospedagem:** Cloudflare Pages, publicado automaticamente a cada push na branch `main`

## Modo demonstração (ligado)

Para o portfólio, o site roda com **dados locais no navegador de cada visitante** (`demo: true` em `config.js`):
- `demo/demo-db.js` imita o cliente do Supabase (consultas, junções, login e fotos) e reescreve em JavaScript as funções do `schema.sql`. Começa só com o cadastro da barbearia (serviços, barbeiros, horários e acessos), sem clientes nem agendamentos, para testar do zero.
- `demo/demo-ui.js` mostra a barra **Demo** (Site · Agendar · Painel · Simular agendamento · Começar do zero · Ajuda), o **tutorial** da primeira visita e o **login com um clique** no painel.

| Acesso | E-mail | Senha | Vê |
|---|---|---|---|
| Dono | `dono@navalhanobre.demo` | `navalha123` | Tudo |
| Barbeiro | `lucas@navalhanobre.demo` | `barbeiro123` | Só a própria agenda e as folgas |

Ninguém vê o teste de outra pessoa, e nada vai para o Supabase. Para usar o banco de verdade, troque `demo: true` por `false` em `config.js` (as linhas de `demo/` nas páginas podem ficar: sem o modo ligado, elas não fazem nada).

## Estrutura
| Caminho | O que é |
|---|---|
| `*.html`, `style.css`, `script.js` | Páginas públicas |
| `agendar.*`, `cancelar.*`, `precos.js` | Agendamento online e preços vindos do banco |
| `config.js` | Endereço e chave pública do Supabase |
| `admin/` | Painel (`/admin`): agenda, serviços, equipe, ajustes |
| `supabase/` | Esquema do banco e guia de configuração (não é publicado) |
| `demo/` | Banco local, barra e tutorial da demonstração |
| `build.sh` | Monta a pasta `dist/` publicada |

## Publicação (Cloudflare Pages)
- **Build command:** `sh build.sh`
- **Build output directory:** `dist`
