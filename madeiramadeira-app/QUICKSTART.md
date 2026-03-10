# 🚀 Quick Start Guide

## Setup Rápido (5 minutos)

### 1. Instalar dependências

```powershell
cd .\madeiramadeira-app
npm install-all
```

### 2. Configurar PostgreSQL e Redis com Docker

```powershell
docker-compose up -d
```

Aguarde 30 segundos para os serviços iniciarem.

### 3. Criar arquivo .env no backend

```powershell
# Dentro de: backend/
$env_content = @"
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://user:password@localhost:5432/madeiramadeira
REDIS_URL=redis://localhost:6379

JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d

MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
MADEIRAMADEIRA_API_URL=https://marketplace.madeiramadeira.com.br
MADEIRAMADEIRA_SANDBOX_URL=https://marketplace-sandbox.madeiramadeira.com.br
"@

# Salvar manualmente em: backend/.env
```

### 4. Iniciar em desenvolvimento

```powershell
npm run dev
```

**Acesso:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/health

### 5. Login de Teste

Criar conta ou usar:
- Username: `admin`
- Email: `admin@example.com`
- Password: `123456`

## Estrutura de Arquivos Criada

```
backend/
├── src/
│   ├── controllers/      # Lógica de requisições HTTP
│   ├── services/         # Regras de negócio
│   ├── routes/           # Definição de endpoints
│   ├── middleware/       # Auth, erro, etc
│   ├── database/         # Conexão PostgreSQL
│   ├── types/            # Interfaces TypeScript
│   └── index.ts          # Servidor Express

frontend/
├── src/
│   ├── pages/            # DashboardPage, OrdersPage, ProductsPage, LoginPage
│   ├── components/       # Navbar, ProtectedRoute
│   ├── stores/           # Zustand (authStore)
│   ├── api/              # axios client, endpoints
│   ├── types/            # Interfaces TypeScript
│   └── App.tsx           # App principal
```

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia frontend + backend em desenvolvimento |
| `npm run build` | Build para produção |
| `npm -w backend run dev` | Backend apenas |
| `npm -w frontend run dev` | Frontend apenas |
| `npm run typecheck` | Valida tipos TypeScript |

## Próximos Passos

1. ✅ Backend pronto com endpoints de autenticação e marketplace
2. ✅ Frontend com login, dashboard, pedidos e produtos
3. 📝 **TODO**: Integrar com API real do MadeiraMadeira
4. 📝 **TODO**: Adicionar testes (Jest + RTL)
5. 📝 **TODO**: Deploy no Render

## Deploy no Render

1. Fazer commit e push para GitHub
2. No Render.com:
   - Conectar repositório
   - Criar Web Service com PostgreSQL + Redis
   - Configurar variáveis de ambiente
   - Deploy

Ver README.md para instruções detalhadas.

## Troubleshooting

### Porta 3000/3001 em uso?

```powershell
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3001
kill -9 <PID>
```

### Erro de conexão com BD

```powershell
# Verificar docker
docker-compose ps

# Reiniciar
docker-compose restart postgres
```

### Limpar tudo

```powershell
docker-compose down -v
rm -r node_modules
npm install-all
```

## Arquivos Importantes

- `docker-compose.yml` - Stack local (PostgreSQL + Redis)
- `Dockerfile` - Build para produção
- `Procfile` - Deploy no Render
- `.env` - Variáveis de ambiente (não commitar!)
- `.github/workflows/ci.yml` - CI/CD automático

## Documentação da API

Endpoints disponíveis em: `/api/marketplace/*`

Ver `frontend/src/api/endpoints.ts` para lista completa.

---

**Pronto?** Execute `npm run dev` e bom desenvolvimento! 🚀
