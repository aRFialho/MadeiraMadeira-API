# 🚀 Deploy no Render

## URL da API
```
https://madeiraapi.onrender.com
```

## Passo a Passo de Deploy

### 1. Conectar Repositório GitHub

1. Ir para https://dashboard.render.com
2. Criar uma conta ou fazer login
3. Clicar em "New +" → "Web Service"
4. Clicar em "Connect a repository"
5. Selecionar: `https://github.com/aRFialho/MadeiraMadeira-API.git`

### 2. Configurar Backend (API)

**Nome do Serviço**: `madeiramadeira-api`

**Configurações**:
- **Environment**: Node
- **Build Command**: `npm run install-all && npm run build`
- **Start Command**: `npm -w backend run start`
- **Region**: Oregon (ou sua preferência)

**Variáveis de Ambiente**:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=<gerar automaticamente>
JWT_EXPIRES_IN=7d
MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
MADEIRAMADEIRA_API_URL=https://marketplace.madeiramadeira.com.br
DATABASE_URL=<será configurado com PostgreSQL>
```

### 3. Criar PostgreSQL

1. No dashboard Render, clicar em "New +" → "PostgreSQL"
2. Nome: `madeiramadeira-db`
3. Região: Oregon (mesma da API)
4. Plano: Free ou Standard
5. Copiar a URL de conexão e adicionar como `DATABASE_URL` no Backend

### 4. Criar Redis (Opcional)

1. Clicar em "New +" → "Redis"
2. Nome: `madeiramadeira-redis`
3. Região: Oregon
4. Copiar URL e adicionar como `REDIS_URL`

### 5. Configurar Frontend (Web UI)

1. Clicar em "New +" → "Static Site"
2. **Nome**: `madeiramadeira-web`
3. **Publish directory**: `frontend/dist`
4. **Build Command**: `npm run install-all && npm -w frontend run build`
5. Configurar variável de ambiente:
   ```
   VITE_API_URL=https://madeiraapi.onrender.com
   ```

### 6. Deploy

- Selecionar branch: `main`
- Clicar em "Create Web Service"
- Render fará o deploy automaticamente

## URLs Resultantes

**Backend API**:
```
https://madeiraapi.onrender.com
```

**Frontend**:
```
https://madeiramadeira-web.onrender.com
```

## Health Check

Verificar se API está online:
```bash
curl https://madeiraapi.onrender.com/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-03-10T...",
  "mode": "production"
}
```

## Comandos Úteis

**Ver logs**:
```bash
# No dashboard Render, clicar em "Logs"
```

**Redeploy**:
```bash
# Push para main
git push origin main
# Render fará deploy automaticamente
```

**Conectar banco de dados**:
```bash
psql <DATABASE_URL>
```

## Monitoramento

- Dashboard Render: https://dashboard.render.com
- Verificar Status da API: https://madeiraapi.onrender.com/health
- Logs em tempo real: Dashboard → madeiramadeira-api → Logs

## Troubleshooting

**API não conecta ao banco**:
- Verificar se PostgreSQL está online no dashboard
- Verificar DATABASE_URL está correto
- Ver logs no dashboard

**Frontend não carrega**:
- Verificar build logs no dashboard
- Confirmar VITE_API_URL aponta para API correta
- Limpar cache do navegador (Ctrl+Shift+Delete)

**Rate Limiting**:
- Render tem limites na camada gratuita
- Para produção, considerar upgrade para plano pago

---

**Status**: Pronto para deploy ✅
