// server.js (RAIZ)
"use strict";

const express = require("express");
const path = require("path");

// ✅ Carrega o .env do ML na suite
require("dotenv").config({ path: path.join(__dirname, "ml", ".env") });

const createMlApp = require("./ml");
const createShopeeApp = require("./shopee"); // ✅ aponta para shopee/index.js

async function main() {
  const app = express();

  app.set("trust proxy", 1);
  app.set("etag", false);

  app.use("/ml", express.static(path.join(__dirname, "ml", "public")));

  app.get("/healthz", (_req, res) =>
    res.json({ ok: true, app: "davanttiSuite" }),
  );

  app.get("/", (_req, res) => res.redirect("/selecao-plataforma"));

  app.get("/selecao-plataforma", (_req, res) => {
    return res.sendFile(
      path.join(__dirname, "ml", "views", "selecao-plataforma.html"),
    );
  });

  app.get("/go/ml", (_req, res) => res.redirect("/ml/login"));
  app.get("/go/shopee", (_req, res) => res.redirect("/shopee/login"));

  const mlApp = await createMlApp();
  app.use("/ml", mlApp);

  const shopeeApp = await createShopeeApp();
  app.use("/shopee", shopeeApp);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "Rota não encontrada (suite)",
      path: req.originalUrl,
      method: req.method,
    });
  });

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Suite rodando na porta ${PORT}`);
  });

  function shutdown(signal) {
    console.log(`[SUITE] Recebido ${signal}, encerrando...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[SUITE] Falha ao iniciar:", err);
  process.exit(1);
});
