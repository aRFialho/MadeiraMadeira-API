# Setup sem Docker - PostgreSQL Local

## Opção 1: Usar serviço online (Recomendado para teste rápido)

Use um banco PostgreSQL online gratuito via Render ou Vercel Postgres:

### 1. Render PostgreSQL Gratuito
1. Ir para https://render.com
2. Create > PostgreSQL
3. Copiar connection string
4. Colar em `backend/.env` na linha `DATABASE_URL=`

**Exemplo:**
```
DATABASE_URL=postgresql://user:password@dpg-xxx.render.internal:5432/dbname
```

---

## Opção 2: PostgreSQL Local (Windows)

### Instalação

1. **Baixar PostgreSQL 15**
   - Link: https://www.postgresql.org/download/windows/
   - Download "Interactive installer"

2. **Instalar**
   - Executar o instalador
   - Username: `postgres`
   - Password: `password` (para teste)
   - Port: `5432` (default)

3. **Verificar instalação**
   ```powershell
   psql --version
   ```

### Criar banco de dados

```powershell
# Conectar como admin
psql -U postgres

# No prompt PostgreSQL:
CREATE DATABASE madeiramadeira;
CREATE USER "user" WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE "madeiramadeira" TO "user";

# Sair
\q
```

### Atualizar .env

```
DATABASE_URL=postgresql://user:password@localhost:5432/madeiramadeira
REDIS_URL=redis://localhost:6379
```

---

## Opção 3: Redis Local (Windows)

### Via Windows Subsystem for Linux (WSL2)

1. **Abrir PowerShell como Admin:**
   ```powershell
   wsl --install
   ```

2. **Reiniciar e iniciar WSL:**
   ```powershell
   wsl
   ```

3. **Dentro do WSL (Ubuntu):**
   ```bash
   sudo apt-get update
   sudo apt-get install redis-server

   # Iniciar Redis
   redis-server
   ```

### Alternativa: Redis Cloud (Gratuito)

1. Ir para https://redis.com/cloud/
2. Sign up com Google/GitHub
3. Create Free Database
4. Copiar connection string
5. Atualizar `backend/.env`:
   ```
   REDIS_URL=redis://:password@host:port
   ```

---

## Opção 4: Usar Render para tudo (Mais fácil)

Se não quer instalar nada localmente:

### Services Render Gratuitos

1. **PostgreSQL**
   - https://render.com → Create PostgreSQL
   - Copiar URL

2. **Redis**
   - https://render.com → Create Redis
   - Copiar URL

3. **Atualizar .env:**
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   ```

4. **Rodar localmente** com dados na nuvem!

---

## Verificar Conexão

```powershell
# Terminal 1: PostgreSQL
psql -U user -d madeiramadeira -h localhost -c "SELECT 1"

# Terminal 2: Redis
redis-cli ping
# Deve retornar: PONG
```

---

## Próximo Passo

Quando tiver banco configurado, execute:

```powershell
cd C:\Users\USER\PycharmProjects\madeiramadeira-app
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
