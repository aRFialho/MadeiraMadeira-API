# ✅ Checklist - Rodar Aplicação em 5 Minutos

## Status Atual
- ✅ Backend código pronto
- ✅ Frontend código pronto
- ✅ Dependências instaladas
- ✅ Configurações criadas
- ⏳ **FALTANDO: PostgreSQL local**

---

## 5 Passos para Rodar

### ✅ Passo 1: Instalar PostgreSQL (2 minutos)

**Windows - Opção A: Installer (Recomendado)**
```
1. Abrir: https://www.postgresql.org/download/windows/
2. Clicar "Download the installer"
3. Executar arquivo .exe
4. Quando pedir password: digitar "password"
5. Deixar porta 5432
6. Instalar completo
```

**Windows - Opção B: Chocolatey**
```powershell
choco install postgresql
```

---

### ✅ Passo 2: Criar Banco (1 minuto)

Abrir **PowerShell como Admin** e colar:

```powershell
psql -U postgres -c "CREATE DATABASE madeiramadeira; CREATE USER madmad_user WITH PASSWORD 'madmad_password'; GRANT ALL PRIVILEGES ON DATABASE madeiramadeira TO madmad_user;"
```

Se retornar "error", executar linha por linha:
```powershell
# Abrir psql interativo
psql -U postgres

# Dentro do prompt (psql=#):
CREATE DATABASE madeiramadeira;
CREATE USER "madmad_user" WITH PASSWORD 'madmad_password';
GRANT ALL PRIVILEGES ON DATABASE "madeiramadeira" TO "madmad_user";
\q
```

---

### ✅ Passo 3: Testar Conexão (30 segundos)

```powershell
cd C:\Users\USER\PycharmProjects\madeiramadeira-app\backend
node test-db.js
```

**Esperado:**
```
✅ Database connection successful!
```

---

### ✅ Passo 4: Rodar Aplicação (1 minuto)

```powershell
cd C:\Users\USER\PycharmProjects\madeiramadeira-app
npm run dev
```

**Esperado nos logs:**
```
🚀 MadeiraMadeira API
✅ Server running on port 3001
📍 Frontend: http://localhost:3000
🔌 API: http://localhost:3001
```

---

### ✅ Passo 5: Testar no Navegador (30 segundos)

Abrir navegador e acessar:
1. **Frontend**: http://localhost:3000
2. **API Health**: http://localhost:3001/health
3. **API Root**: http://localhost:3001

**Criar conta:**
- Username: `admin`
- Email: `admin@test.com`
- Password: `Test1234!`

**Login e explorar:**
- 📊 Dashboard
- 📋 Pedidos
- 📦 Produtos

---

## ⚠️ Se Falhar

### Erro: "psql: command not found"
```
→ PostgreSQL não está no PATH
→ Reiniciar computador DEPOIS de instalar
→ Ou adicionar ao PATH manualmente
```

### Erro: "password authentication failed"
```
→ Senha está errada
→ Use exatamente: password
→ Reiniciar PostgreSQL: Ctrl+R → services.msc → postgres → Restart
```

### Erro: "could not connect to database server"
```
→ PostgreSQL não está rodando
→ Windows: Services → Procurar "postgres" → Clicar Start
```

### Erro: "Database connection failed"
```
→ Rodar novamente: node test-db.js
→ Se continuar: executar Passo 2 novamente
```

---

## 📁 Arquivos Importantes

| Arquivo | O que é |
|---------|---------|
| `backend/.env` | Configuração (DATABASE_URL está lá) |
| `backend/test-db.js` | Testa conexão com BD |
| `POSTGRESQL_SETUP.md` | Guia mais detalhado |
| `README.md` | Documentação completa |

---

## 🎯 Quick Commands

```powershell
# Verificar se PostgreSQL está rodando
psql -U postgres -c "SELECT 1"

# Testar BD específico
psql -U madmad_user -d madeiramadeira -c "SELECT 1"

# Ver databases
psql -U postgres -c "\l"

# Parar e iniciar servidor
# Windows → Services → Procurar "postgres" → Stop/Start

# Se tudo está OK, rodar:
npm run dev
```

---

## ✨ Resultado Final

```
✅ Backend: http://localhost:3001
✅ Frontend: http://localhost:3000
✅ Dashboard com gráficos
✅ Gerenciamento de pedidos
✅ Gerenciamento de produtos
```

---

**Pronto?** Comece pelo **Passo 1**! 🚀

Quando concluir TODOS os passos, a aplicação estará rodando localmente!
