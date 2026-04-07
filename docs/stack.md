# Stack do Workout Tracker (Brio)

## Hospedagem — Railway

- Configurado via `railway.json`
- Build com **Nixpacks** (detecta Node.js automaticamente)
- Comando de start: `node server.js`
- Restart automático em caso de falha (até 10 tentativas)

---

## Backend

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Autenticação | JWT (`jsonwebtoken`) + senhas com `bcryptjs` |
| Upload de imagens | Cloudinary SDK |
| Middleware de upload | multer (`src/middleware/upload.js`) |

### API REST

| Rota | Descrição |
|---|---|
| `POST /api/auth/register` | Cadastro de usuário |
| `POST /api/auth/login` | Login, retorna JWT |
| `GET/POST/PUT/DELETE /api/templates` | CRUD de templates de treino |
| `POST /api/templates/:id/exercises` | Adicionar exercício ao template |
| `PUT/DELETE /api/templates/:id/exercises/:exerciseId` | Editar/remover exercício |
| `GET/POST /api/workouts` | Listar e registrar treinos |

Todas as rotas exceto auth exigem `Authorization: Bearer <token>`.

---

## Banco de Dados — PostgreSQL

Hospedado no Railway (plugin PostgreSQL). Conectado via `DATABASE_URL` usando pool de conexões (`pg`).

### Tabelas

| Tabela | Descrição |
|---|---|
| `users` | Usuários: nome, email, hash da senha |
| `workout_templates` | Templates de treino criados por usuário |
| `template_exercises` | Exercícios de um template (ordem, sets padrão, flag unilateral) |
| `workouts` | Treinos realizados: notas, brio mode, foto, timestamps |
| `exercise_logs` | Séries registradas: peso, reps, RIR, reps esq/dir |
| `workout_likes` | Curtidas em treinos (unique por user+workout) |
| `workout_comments` | Comentários em treinos |

Schema completo em `src/db/schema.sql`.

---

## Frontend

| Camada | Tecnologia |
|---|---|
| Tipo | SPA vanilla (sem framework) |
| Linguagens | HTML, CSS, JavaScript puro |
| Servido por | Express (`express.static` apontando para `public/`) |
| PWA | Sim — Service Worker + Web App Manifest |

O app é instalável no celular como PWA com o nome **Brio**.  
O Service Worker (`public/sw.js`) faz cache de assets estáticos e deixa chamadas à API sempre na rede.

---

## Armazenamento de Mídias — Cloudinary

Fotos dos treinos são enviadas ao Cloudinary. A URL pública e o `public_id` ficam salvos nas colunas `photo_url` e `photo_public_id` da tabela `workouts`.

Configurado via variável de ambiente `CLOUDINARY_URL` (ou `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` como fallback).

---

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL (Railway injeta automaticamente) |
| `JWT_SECRET` | Segredo para assinar os tokens JWT |
| `PORT` | Porta do servidor (Railway injeta automaticamente) |
| `NODE_ENV` | `development` ou `production` |
| `CLOUDINARY_URL` | URL completa do Cloudinary (formato `cloudinary://key:secret@cloud`) |
| `CLOUDINARY_CLOUD_NAME` | Fallback: nome do cloud |
| `CLOUDINARY_API_KEY` | Fallback: API key |
| `CLOUDINARY_API_SECRET` | Fallback: API secret |

---

## Fluxo Geral

```
Usuário (browser / PWA instalado)
    ↓ HTTPS
Railway (Express.js)
    ├── Serve o frontend SPA  →  public/
    ├── API REST (/api/*)
    │     ├── Auth via JWT
    │     └── Dados  →  PostgreSQL (Railway)
    └── Upload de fotos  →  Cloudinary
```
