# ⚡ Setup Rápido - Teste em 5 minutos

## Pré-requisito: PostgreSQL Gratuito na Nuvem

### Opção A: Render (Recomendado - MAIS FÁCIL)

```
1. Ir para: https://render.com
2. Criar conta com GitHub/Google
3. Dashboard → "Create" → PostgreSQL
4. Clicar em "Create Database"
5. Esperar 2-3 minutos para criar
6. Copiar a URL de conexão completa
7. Colar em: backend/.env na linha DATABASE_URL=
```

**Exemplo de URL:**
```
postgresql://user:password@dpg-xxxxx.render.internal:5432/dbname
```

### Opção B: Supabase (Alternativa)

```
1. Ir para: https://supabase.com
2. Criar conta
3. Create new project
4. Copiar "Connection String" para "Pooling"
5. Colar em: backend/.env
```

---

## Passo 1: Atualizar .env

Arquivo: `backend/.env`

```
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://user:password@dpg-xxxxx.render.internal:5432/dbname

JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
MADEIRAMADEIRA_API_URL=https://marketplace.madeiramadeira.com.br
MADEIRAMADEIRA_SANDBOX_URL=https://marketplace-sandbox.madeiramadeira.com.br
```

**Nota:** Pode remover REDIS_URL por enquanto (não é obrigatório)

---

## Passo 2: Rodar Aplicação

```powershell
cd C:\Users\USER\PycharmProjects\madeiramadeira-app

# Instalar tudo (já feito, mas se precisar reinstalar)
npm run install-all

# Iniciar backend + frontend
npm run dev
```

**Output esperado:**
```
✅ Server running on port 3001
📍 Frontend: http://localhost:3000
🔌 API: http://localhost:3001
❤️  Health: http://localhost:3001/health
```

---

## Passo 3: Testar

### Abrir navegador:

1. **Frontend**: http://localhost:3000
2. **API Health**: http://localhost:3001/health
3. **API Root**: http://localhost:3001

### Criar conta de teste:
- Username: `admin`
- Email: `admin@madeira.com`
- Password: `Password123!`

---

## Tabelas criadas automaticamente

Na primeira execução, o backend cria:
- ✅ `users` - Usuários
- ✅ `products` - Produtos do marketplace
- ✅ `orders` - Pedidos
- ✅ `sales_metrics` - Métricas de vendas

---

## Troubleshooting

### Erro: "connect ECONNREFUSED 127.0.0.1:5432"

```
→ DATABASE_URL está incorreta
→ Copiar URL exata do Render/Supabase
→ Testar conexão: psql <DATABASE_URL>
```

### Erro: "nodemon not found"

```powershell
npm install -g ts-node
npm -w backend run dev
```

### Port 3000/3001 já em uso

```powershell
# Mudar PORT no .env
PORT=3002

# Ou kill o processo:
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

---

## Arquivos importantes

| Arquivo | Descrição |
|---------|-----------|
| `backend/.env` | Variáveis de ambiente |
| `backend/src/index.ts` | Servidor Express |
| `frontend/src/App.tsx` | App React |
| `docker-compose.yml` | Para quando instalar Docker |

---

## Comandos úteis

```powershell
# Apenas backend
npm -w backend run dev

# Apenas frontend
npm -w frontend run dev

# Build produção
npm run build

# TypeCheck
npm run typecheck
```

---

**Pronto?** Execute `npm run dev` e acesse http://localhost:3000 🚀
