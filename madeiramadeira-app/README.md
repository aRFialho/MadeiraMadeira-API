# MadeiraMadeira Dashboard

API Desktop web para edição e controle de pedidos e produtos com dashboards de vendas.

## Funcionalidades

- 📊 **Dashboard**: Gráficos de vendas diárias, semanais, mensais e anuais com projeção de faturamento
- 📦 **Gestão de Produtos**: Busca, filtros e edição unitária/em lote
- 📋 **Controle de Pedidos**: Visualização e atualização de status
- 🔐 **Autenticação**: Login seguro com JWT
- 💾 **Sincronização**: Sincronização com API do Marketplace MadeiraMadeira

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Deploy**: Render

## Pré-requisitos

- Node.js >= 18
- npm ou yarn
- PostgreSQL (local ou via Docker)
- Redis (local ou via Docker)

## Instalação Local

### 1. Clonar e instalar dependências

```bash
cd madeiramadeira-app
npm install-all
```

### 2. Configurar variáveis de ambiente

Criar arquivo `.env` no diretório `backend`:

```
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://user:password@localhost:5432/madeiramadeira
REDIS_URL=redis://localhost:6379

JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
MADEIRAMADEIRA_API_URL=https://marketplace.madeiramadeira.com.br
MADEIRAMADEIRA_SANDBOX_URL=https://marketplace-sandbox.madeiramadeira.com.br
```

### 3. Executar com Docker Compose (recomendado)

```bash
docker-compose up
```

### 4. Iniciar aplicação em desenvolvimento

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Estrutura do Projeto

```
madeiramadeira-app/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Controladores da aplicação
│   │   ├── services/       # Lógica de negócio
│   │   ├── routes/         # Definição de rotas
│   │   ├── middleware/     # Middleware de autenticação
│   │   ├── database/       # Conexão com BD
│   │   ├── types/          # Tipos TypeScript
│   │   └── index.ts        # Arquivo principal
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── components/     # Componentes React
│   │   ├── stores/         # Estado global (Zustand)
│   │   ├── api/            # Clientes de API
│   │   ├── types/          # Tipos TypeScript
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Build para Produção

```bash
npm run build
```

Isso irá:
1. Compilar TypeScript do backend
2. Build do frontend com Vite
3. Gerar artefatos prontos para deploy

## Deploy no Render

### 1. Preparar repositório

```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Criar serviço no Render

- Ir para https://render.com
- Conectar repositório GitHub
- Criar novo "Web Service"
- Configurar:
  - **Build Command**: `npm install-all && npm run build`
  - **Start Command**: `npm -w backend run start`
  - **Environment Variables**:
    ```
    NODE_ENV=production
    DATABASE_URL=postgresql://user:password@host:5432/db
    REDIS_URL=redis://user:password@host:6379
    JWT_SECRET=sua-chave-secreta
    MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
    ```

### 3. Criar instância PostgreSQL no Render

- New PostgreSQL Database
- Copiar connection string para DATABASE_URL

### 4. Criar cache Redis no Render

- New Redis
- Copiar connection string para REDIS_URL

### 5. Servir Frontend

- Conectar repositório
- Executar comando de build do frontend
- Configurar public directory como `frontend/dist`

## API Endpoints

### Autenticação

```
POST /api/auth/register
POST /api/auth/login
```

### Marketplace

```
GET /api/marketplace/products?limit=100&offset=0
GET /api/marketplace/orders?limit=100&offset=0
PUT /api/marketplace/products/:sku
PUT /api/marketplace/orders/:orderId/status
GET /api/marketplace/dashboard/metrics
GET /api/marketplace/dashboard/chart?days=30
```

## Troubleshooting

### Conexão com banco de dados
- Verificar se PostgreSQL está rodando
- Validar DATABASE_URL

### Erro ao conectar com API MadeiraMadeira
- Validar token no MADEIRAMADEIRA_TOKEN
- Verificar se URL está correta
- Validar limites de rate limit

### Port já em uso
- Backend: Mudar PORT no .env
- Frontend: Usar `npm run dev -- --port 3001`

## Contribuindo

1. Criar branch: `git checkout -b feature/nome`
2. Commit: `git commit -am 'Add feature'`
3. Push: `git push origin feature/nome`
4. Abrir Pull Request

## Suporte

Para problemas ou dúvidas, abrir uma issue no GitHub.
