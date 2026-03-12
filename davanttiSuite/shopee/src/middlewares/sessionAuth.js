const prisma = require("../config/db");

const PUBLIC_PATHS = [
  "/login",
  "/auth/register",
  "/auth/url",
  "/auth/callback",
  "/auth/refresh",
  "/status",
  "/healthz",
];

function getSid(req) {
  return req.cookies?.sid || null;
}

async function sessionAuth(req, res, next) {
  console.log(`[sessionAuth] ${req.method} ${req.path}`); // ✅ LOG

  // ✅ Pular autenticação para rotas públicas
  if (PUBLIC_PATHS.includes(req.path)) {
    console.log(`[sessionAuth] Rota pública: ${req.path}, pulando`);
    req.auth = null;
    return next();
  }

  try {
    const sid = getSid(req);
    if (!sid) {
      console.log(`[sessionAuth] Sem cookie sid`);
      req.auth = null;
      return next();
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        user: { include: { account: true } },
      },
    });

    if (!session) {
      console.log(`[sessionAuth] Sessão não encontrada: ${sid}`);
      req.auth = null;
      return next();
    }

    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      console.log(`[sessionAuth] Sessão expirada: ${sid}`);
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
      req.auth = null;
      return next();
    }

    console.log(`[sessionAuth] Autenticado: ${session.user.email}`);
    req.auth = {
      sid: session.id,
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      accountId: session.user.accountId,
      accountName: session.user.account?.name || null,
      activeShopId: session.activeShopId || null,
      impersonating: Boolean(session.impersonating),
      realUserId: session.realUserId || null,
    };

    return next();
  } catch (err) {
    console.error(`[sessionAuth] Erro:`, err);
    return next(err);
  }
}

function requireAuth(req, res, next) {
  console.log(`[requireAuth] ${req.method} ${req.path} - auth:`, !!req.auth); // ✅ LOG

  if (!req.auth) {
    return res
      .status(401)
      .json({ error: "unauthorized", message: "Não autenticado." });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res
        .status(401)
        .json({ error: "unauthorized", message: "Não autenticado." });
    }
    if (!roles.includes(req.auth.role)) {
      return res
        .status(403)
        .json({ error: "forbidden", message: "Sem permissão." });
    }
    return next();
  };
}

module.exports = {
  sessionAuth,
  requireAuth,
  requireRole,
};
