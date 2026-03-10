# ⚡ PostgreSQL Setup - 3 Passos (5 minutos)

## Passo 1: Instalar PostgreSQL

### Windows - Usando Installer (Recomendado)

1. Baixar: https://www.postgresql.org/download/windows/
2. Clicar em "Download the installer"
3. Executar o instalador
4. **Importante**: Quando pedir password, use: `password`
5. Deixar porta como `5432` (default)
6. Concluir instalação

### Windows - Usando Chocolatey (Rápido)

Se tem Chocolatey instalado:
```powershell
choco install postgresql
```

---

## Passo 2: Criar Banco de Dados

Abrir **PowerShell como Administrador** e executar:

```powershell
# Conectar ao PostgreSQL
psql -U postgres

# Dentro do prompt PostgreSQL (psql):
CREATE DATABASE madeiramadeira;
CREATE USER "madmad_user" WITH PASSWORD 'madmad_password';
ALTER ROLE "madmad_user" WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE "madeiramadeira" TO "madmad_user";
GRANT USAGE ON SCHEMA public TO "madmad_user";
GRANT CREATE ON SCHEMA public TO "madmad_user";

# Sair
\q
```

---

## Passo 3: Testar Conexão

```powershell
cd C:\Users\USER\PycharmProjects\madeiramadeira-app\backend
node test-db.js
```

Deve mostrar: ✅ Database connection successful!

---

Se tudo OK, volte para a pasta raiz:

```powershell
cd ..
npm run dev
```

**Pronto!** 🎉

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

---

## Troubleshooting

### "psql: command not found"
→ PostgreSQL não está instalado ou não está no PATH
→ Reinstalar PostgreSQL e adicionar ao PATH

### "FATAL: password authentication failed"
→ Senha incorreta
→ Use `password` (conforme instalação)

### "could not translate host name"
→ PostgreSQL não está rodando
→ Windows: Services → Procurar "postgres" → Iniciar
→ macOS: `brew services start postgresql`

### "Já tem banco criado?"
```powershell
psql -U madmad_user -d madeiramadeira -c "SELECT 1"
```

Se retornar `1`, banco existe! ✅

---

**Instalado com sucesso?** Execute:
```powershell
npm run dev
```
