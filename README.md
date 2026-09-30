# Styllo Barbearia

Site da Styllo Barbearia (Patos - PB) com agendamento online e painel administrativo.

- **Site:** HTML, CSS e JavaScript puros (sem framework)
- **Banco e login:** [Supabase](https://supabase.com) — esquema em `supabase/schema.sql`
- **Hospedagem:** Cloudflare Pages, publicado automaticamente a cada push na branch `main`

## Estrutura
| Caminho | O que é |
|---|---|
| `*.html`, `style.css`, `script.js` | Páginas públicas |
| `agendar.*`, `cancelar.*`, `precos.js` | Agendamento online e preços vindos do banco |
| `config.js` | Endereço e chave pública do Supabase |
| `admin/` | Painel (`/admin`): agenda, serviços, equipe, ajustes |
| `supabase/` | Esquema do banco e guia de configuração (não é publicado) |
| `build.sh` | Monta a pasta `dist/` publicada |

## Publicação (Cloudflare Pages)
- **Build command:** `sh build.sh`
- **Build output directory:** `dist`
