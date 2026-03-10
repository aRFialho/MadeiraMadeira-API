# PostgreSQL Setup Rápido (Windows)

## Opção 1: PostgreSQL Portável (Mais Fácil) ⭐

Baixe e extraia:
```
https://www.postgresql.org/download/windows/
```

Ou instale via Chocolatey (se tiver):
```powershell
choco install postgresql
```

Depois de instalar, crie o banco:

```powershell
# Abrir Command Prompt como Admin
psql -U postgres

# No prompt PostgreSQL:
CREATE DATABASE madeiramadeira;
CREATE USER "madmad_user" WITH PASSWORD 'madmad_password';
ALTER ROLE "madmad_user" WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE "madeiramadeira" TO "madmad_user";
GRANT USAGE ON SCHEMA public TO "madmad_user";
GRANT CREATE ON SCHEMA public TO "madmad_user";
\q
```

## Atualizar .env

Arquivo: `backend/.env`

```
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://madmad_user:madmad_password@localhost:5432/madeiramadeira

JWT_SECRET=dev-secret-key
JWT_EXPIRES_IN=7d

MADEIRAMADEIRA_TOKEN=MMKTP18042018145802
MADEIRAMADEIRA_API_URL=https://marketplace.madeiramadeira.com.br
```

## Testar Conexão

```powershell
cd backend
node test-db.js
```

Deve retornar: ✅ Database connection successful!

---

## Opção 2: Usar Render (Gratuito online)

1. Ir para: https://render.com
2. Sign up com GitHub
3. Dashboard → Create → PostgreSQL
4. Aguardar criação (~3 minutos)
5. Copiar connection string
6. Colar em `backend/.env`

---

## Opção 3: Usar Online DB Gratuito

```
https://www.elephantsql.com/ (ElephantSQL)
ou
https://vercel.com/postgres (Vercel Postgres)
ou
https://railway.app/ (Railway)
```

Todos têm planos gratuitos!

---

Após configurar, execute:
```powershell
npm run dev
```
