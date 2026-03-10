# 🚀 TESTE FINAL - Rodando a Aplicação

## Status ✅

- ✅ Backend TypeScript compilado
- ✅ Frontend build realizado (dist criado)
- ✅ Dependências instaladas
- ✅ Tipos TypeScript corretos

---

## 1. Preparar Banco de Dados

### Opção A: Render PostgreSQL (RECOMENDADO)

```
1. Ir para: https://render.com
2. Sign in com GitHub/Google
3. Dashboard → "Create" → "PostgreSQL"
4. Esperar criar (~2-3 min)
5. Copiar URL conexão completa
```

### Opção B: PostgreSQL Local (Windows)

```
1. Baixar: https://www.postgresql.org/download/windows/
2. Instalar (use senha "password")
3. Abrir PowerShell como Admin:
   psql -U postgres
4. Executar:
   CREATE DATABASE madeiramadeira;
   CREATE USER "user" WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE "madeiramadeira" TO "user";
   \q
```

---

## 2. Configurar .env

Arquivo: `backend/.env`

**Com Render:**
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:xxxxx@dpg-xxxxx.render.internal:5432/dbname
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
MADEIRAMADEIRA_API_URL=https://marketplace.madeiramadeira.com.br
```

**Com PostgreSQL Local:**
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/madeiramadeira
JWT_SECRET=dev-secret-key
JWT_EXPIRES_IN=7d
MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
MADEIRAMADEIRA_API_URL=https://marketplace.madeiramadeira.com.br
```

---

## 3. Testar Conexão com BD

```powershell
# Com Render ou Local:
$env:DATABASE_URL = "postgresql://user:password@host:5432/dbname"
psql $env:DATABASE_URL -c "SELECT 1"
```

Se retornar `1`, banco está OK ✅

---

## 4. Rodar a Aplicação

```powershell
cd C:\Users\USER\PycharmProjects\madeiramadeira-app

# Terminal 1: Backend
npm -w backend run dev

# Terminal 2 (novo PowerShell): Frontend
npm -w frontend run dev
```

**Output esperado:**

Terminal 1 (Backend):
```
✅ Server running on port 3001
📍 Frontend: http://localhost:3000
🔌 API: http://localhost:3001
❤️  Health: http://localhost:3001/health
```

Terminal 2 (Frontend):
```
  VITE v4.5.14  ready in 123 ms

  ➜  Local:   http://localhost:3000/
```

---

## 5. Testar Aplicação

### Abrir navegador:

1. **Frontend**: http://localhost:3000
2. **API Health**: http://localhost:3001/health
3. **API Root**: http://localhost:3001

### Criar Conta:

- Username: `admin`
- Email: `admin@test.com`
- Password: `Password123!`

### Login:

Use as credenciais acima para entrar no dashboard

### Funcionalidades:

- 📊 **Dashboard** - Gráficos de vendas
- 📋 **Pedidos** - Tabela e filtros
- 📦 **Produtos** - Edição unitária e em lote

---

## 6. Troubleshooting

### Erro: "connect ECONNREFUSED 127.0.0.1:5432"

```
→ Banco não está rodando
→ DATABASE_URL incorreta
→ Testar com: psql $env:DATABASE_URL
```

### Erro: "Port 3001 already in use"

```powershell
# Matar processo
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Erro: "No module named 'pg'"

```powershell
npm install -w backend
```

### Frontend não carrega

```
→ Limpar cache: Ctrl+Shift+Delete
→ Dev tools: F12 → Console verificar erros
→ Backend rodando? Verificar http://localhost:3001/health
```

---

## 7. Comandos Úteis

```powershell
# Apenas Backend
npm -w backend run dev

# Apenas Frontend
npm -w frontend run dev

# Build produção
npm run build

# TypeCheck
npm run typecheck

# Verificar saúde da API
curl http://localhost:3001/health

# Limpar tudo e reinstalar
rm -r node_modules
npm install-all
npm run dev
```

---

## 8. Próximo: Deploy no Render

Quando tudo funcionar localmente:

```
1. git commit -am "Initial commit"
2. git push
3. Ir para render.com
4. Create new Web Service
5. Conectar repositório GitHub
6. Configurar variáveis de ambiente
7. Deploy automático ✅
```

---

## 📝 Estrutura de Arquivos

```
madeiramadeira-app/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── database/
│   │   ├── routes/
│   │   ├── types/
│   │   └── index.ts
│   ├── .env (criar manualmente)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── api/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── dist/ (build)
│   └── package.json
└── package.json (root)
```

---

**Pronto para testar?** Execute `npm run dev` 🎉
