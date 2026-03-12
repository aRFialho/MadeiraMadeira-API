"use strict";

const analiseAnuncioService = require("../services/analiseAnuncioService");
const { gerarInsightsGemini } = require("../services/geminiInsightsService");
const Cache = require("../services/simpleCache");

function clampDays(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  if (n < 1) return 1;
  if (n > 365) return 365;
  return n;
}

function validateMlb(mlb) {
  return /^MLB\d{6,}$/.test(String(mlb || "").toUpperCase());
}

module.exports = {
  async overview(req, res) {
    try {
      const mlb = String(req.params.mlb || "").toUpperCase();
      if (!validateMlb(mlb)) {
        return res.status(400).json({ ok: false, error: "MLB inválido" });
      }

      const days = clampDays(req.query?.days ?? 30);
      const zip_code = String(req.query?.zip_code || "").trim() || null;

      const accessToken =
        req.ml?.accessToken || res.locals?.accessToken || null;
      if (!accessToken) {
        return res
          .status(401)
          .json({ ok: false, error: "Token indisponível para a conta atual" });
      }

      const data = await analiseAnuncioService.getOverview({
        mlb,
        accessToken,
        days,
        zip_code,
      });

      return res.json({ ok: true, ...data });
    } catch (err) {
      return res
        .status(500)
        .json({ ok: false, error: err?.message || "Erro interno" });
    }
  },

  async insights(req, res) {
    try {
      const hasKey =
        process.env.ML_GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMINI_API_KEY ||
        "";
      const iaEnabled =
        String(process.env.ML_IA_INSIGHTS_ENABLED || "1") === "1";
      if (!iaEnabled) {
        return res.status(503).json({
          ok: false,
          error: "IA desativada (ML_IA_INSIGHTS_ENABLED=0)",
        });
      }
      if (!hasKey) {
        return res.status(503).json({
          ok: false,
          error:
            "IA indisponível: configure ML_GEMINI_API_KEY (ou GOOGLE_API_KEY/GEMINI_API_KEY)",
        });
      }

      const mlb = String(req.params.mlb || "").toUpperCase();
      if (!validateMlb(mlb)) {
        return res.status(400).json({ ok: false, error: "MLB inválido" });
      }

      const days = clampDays(req.query?.days ?? 30);
      const zip_code = String(req.query?.zip_code || "").trim() || null;

      const accessToken =
        req.ml?.accessToken || res.locals?.accessToken || null;
      if (!accessToken) {
        return res
          .status(401)
          .json({ ok: false, error: "Token indisponível para a conta atual" });
      }

      const pack = await analiseAnuncioService.getOverview({
        mlb,
        accessToken,
        days,
        zip_code,
      });

      const ttl = Number(process.env.ML_IA_INSIGHTS_CACHE_TTL_SEC || 0);
      const accountKey = res?.locals?.accountKey || "";
      const model =
        process.env.ML_GEMINI_MODEL ||
        process.env.GEMINI_MODEL ||
        "gemini-2.5-flash-lite";
      const cacheKey = `ia:${mlb}:${days}:${zip_code || ""}:${accountKey}:${model}`;

      let ai = ttl > 0 ? Cache.get(cacheKey) : null;
      if (!ai) {
        ai = await gerarInsightsGemini(pack);
        if (ttl > 0) Cache.set(cacheKey, ai, ttl);
      }
      return res.json(ai);
    } catch (err) {
      if (String(err?.message || "").includes("NO_GEMINI_API_KEY")) {
        return res.status(503).json({
          ok: false,
          error:
            "IA indisponível: configure ML_GEMINI_API_KEY (ou GOOGLE_API_KEY/GEMINI_API_KEY)",
        });
      }
      return res
        .status(500)
        .json({ ok: false, error: err?.message || "Erro interno" });
    }
  },
};
