"use strict";

const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");

const InsightSchema = z.object({
  headline: z.string().default(""),
  scores: z.object({
    seo: z.number().min(0).max(100),
    preco: z.number().min(0).max(100),
    frete: z.number().min(0).max(100),
    conversao: z.number().min(0).max(100),
    risco: z.number().min(0).max(100),
  }),
  resumo: z.string().default(""),
  positivos: z.array(z.string()).default([]),
  problemas: z.array(z.string()).default([]),
  recomendacoes: z.array(z.string()).default([]),
  alertas: z.array(z.string()).default([]),
  insights: z.array(
    z.object({
      tipo: z.enum([
        "titulo",
        "preco",
        "frete",
        "estoque",
        "reputacao",
        "catalogo",
        "premium",
        "conversao",
        "outros",
      ]),
      severidade: z.enum(["alta", "media", "baixa"]),
      o_que_esta_ruim: z.string(),
      acao_recomendada: z.string(),
      impacto_esperado: z.string(),
      evidencias: z.array(z.string()).default([]), // chaves do pack
    }),
  ).default([]),
  experimentos: z
    .array(
      z.object({
        nome: z.string(),
        hipotese: z.string(),
        variacoes: z.array(z.string()),
        metrica: z.string(),
      }),
    )
    .default([]),
  missing_data: z.array(z.string()).default([]),
});

const apiKey =
  process.env.ML_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY;
function getClient() {
  if (!apiKey) throw new Error("NO_GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey });
}

function compactPack(pack) {
  const s = pack?.summary || {};
  const v = pack?.visits || {};
  const m = pack?.metrics || {};
  const rep = pack?.seller_reputation || {};
  const sh = pack?.shipping || {};
  const seller = pack?.seller || {};
  return {
    summary: {
      id: s.id,
      title: s.title,
      price: s.price,
      available_quantity: s.available_quantity,
      sold_quantity: s.sold_quantity,
      listing_type_id: s.listing_type_id,
      catalog_listing: s.catalog_listing,
      official_store_id: s.official_store_id,
      category_id: s.category_id,
      permalink: s.permalink,
      thumbnail: s.thumbnail,
    },
    visits: { total: v.total, date_from: v.date_from, date_to: v.date_to },
    shipping: {
      zip_code: sh.zip_code || null,
      free_shipping: !!sh.free_shipping,
      logistic_type: sh.logistic_type || null,
      mode: sh.mode || null,
    },
    seller: {
      seller_id: seller.seller_id || null,
      nickname: seller.nickname || null,
      official_store: seller.official_store || null,
      location: seller.location || null,
    },
    seller_reputation: {
      level_id: rep.level_id || null,
      power_seller_status: rep.power_seller_status || null,
      transactions: rep.transactions || null,
      metrics: rep.metrics || null,
    },
    metrics: m,
    rank: pack?.rank || null,
    trends: Array.isArray(pack?.trends) ? pack.trends : [],
  };
}

function buildPrompt(analysisPack) {
  const data = compactPack(analysisPack);
  return [
    "Você é uma IA especialista em Mercado Livre (CRO + SEO) e análise de anúncios.",
    "Regras:",
    "- Não invente números.",
    "- Se faltar dado, liste em missing_data.",
    "- Toda recomendação deve citar evidências (chaves do JSON recebido).",
    "- Seja objetiva, focando ações priorizadas.",
    "Retorne APENAS JSON usando as seguintes chaves:",
    "headline (string), scores {seo,preco,frete,conversao,risco},",
    "resumo (string), positivos (array de strings), problemas (array de strings),",
    "insights (array detalhada como no schema), recomendacoes (array de strings), alertas (array de strings),",
    "experimentos (array), missing_data (array).",
    "Use os campos rank e trends do JSON recebido para enriquecer análise.",
    "DADOS (JSON):",
    JSON.stringify(data),
  ].join("\n");
}

function fallbackFromPack(pack) {
  const s = pack?.summary || {};
  const v = pack?.visits || {};
  const rep = pack?.seller_reputation || {};
  const shipping = pack?.shipping || {};
  const conv =
    v && Number(v.total) > 0
      ? Math.min(100, Math.max(0, ((s.sold_quantity || 0) / v.total) * 100))
      : 50;
  const risco =
    rep?.metrics?.claims?.rate != null
      ? Math.max(0, Math.min(100, (rep.metrics.claims.rate || 0) * 100))
      : 50;
  const insights = [];
  const sevConv = conv < 5 ? "alta" : conv < 15 ? "media" : "baixa";
  insights.push({
    tipo: "conversao",
    severidade: sevConv,
    o_que_esta_ruim:
      conv < 5
        ? "Conversão baixa em relação às visitas"
        : "Conversão moderada a baixa",
    acao_recomendada:
      "Revisar título, imagens e atributos; avaliar preço e frete; incluir palavras-chave relevantes",
    impacto_esperado: "Melhorar taxa de conversão e vendas",
    evidencias: ["summary.sold_quantity", "visits.total"],
  });
  const isPremium = String(s.listing_type_id || "")
    .toLowerCase()
    .includes("gold");
  insights.push({
    tipo: "premium",
    severidade: "baixa",
    o_que_esta_ruim: isPremium
      ? "Tipo premium ativo"
      : "Tipo premium indisponível",
    acao_recomendada: isPremium
      ? "Manter boas práticas para aproveitar destaque"
      : "Avaliar upgrade para Premium se elegível",
    impacto_esperado: "Aumentar exposição e CTR",
    evidencias: ["summary.listing_type_id"],
  });
  const hasCatalog = !!s.catalog_listing;
  insights.push({
    tipo: "catalogo",
    severidade: hasCatalog ? "baixa" : "media",
    o_que_esta_ruim: hasCatalog ? "Está em catálogo" : "Fora de catálogo",
    acao_recomendada: hasCatalog
      ? "Garantir que variações e ficha técnica estejam completas"
      : "Avaliar participação em catálogo se disponível",
    impacto_esperado: "Melhorar relevância e descoberta",
    evidencias: ["summary.catalog_listing", "summary.category_id"],
  });
  const freeShip = !!shipping.free_shipping;
  insights.push({
    tipo: "frete",
    severidade: freeShip ? "baixa" : "media",
    o_que_esta_ruim: freeShip ? "Frete grátis ativo" : "Sem frete grátis",
    acao_recomendada: freeShip
      ? "Monitorar custos e taxas para manter margem"
      : "Simular frete grátis em itens estratégicos",
    impacto_esperado: "Melhorar CTR e conversão",
    evidencias: [
      "shipping.free_shipping",
      "shipping.logistic_type",
      "shipping.mode",
    ],
  });
  return {
    headline: `Análise automática do MLB ${s.id || ""}`,
    scores: {
      seo: s.catalog_listing ? 70 : 50,
      preco: 50,
      frete: shipping.free_shipping ? 80 : 40,
      conversao: Number.isFinite(conv) ? Math.round(conv) : 50,
      risco: Number.isFinite(risco) ? Math.round(100 - risco) : 50,
    },
    resumo:
      "Resumo automático com base em dados objetivos do anúncio.",
    positivos: [
      ...(s.is_premium ? ["Anúncio Premium ativo"] : []),
      ...(shipping.free_shipping ? ["Frete grátis ativo"] : []),
    ],
    problemas: [
      ...(!s.catalog_listing ? ["Fora de catálogo"] : []),
      ...(!shipping.free_shipping ? ["Sem frete grátis"] : []),
      ...(conv < 5 ? ["Conversão baixa"] : []),
    ],
    recomendacoes: [
      ...(!s.catalog_listing ? ["Avaliar entrada em catálogo"] : []),
      ...(!shipping.free_shipping ? ["Simular frete grátis em itens estratégicos"] : []),
      ...(conv < 5
        ? ["Revisar título/imagens/atributos e preço para melhorar conversão"]
        : []),
    ],
    alertas: [],
    insights,
    experimentos: [],
    missing_data: ["Modelo não retornou JSON válido estruturado"],
    meta: { fallback: true },
  };
}

async function gerarInsightsGemini(analysisPack) {
  const model =
    process.env.ML_GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash-lite";

  const client = getClient();
  const resp = await client.models.generateContent({
    model,
    contents: buildPrompt(analysisPack),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(InsightSchema),
      maxOutputTokens: 1500,
      temperature: 0.2,
    },
  });
  let parsed = null;
  const dbg = String(process.env.ML_IA_INSIGHTS_DEBUG || "0") === "1";
  if (dbg) {
    try {
      const raw = String(resp.text || "");
      const head = raw.slice(0, 500);
      console.log("[IA raw]", head);
    } catch {}
  }
  try {
    parsed = JSON.parse(resp.text || "");
  } catch {}
  if (parsed) {
    const safe = InsightSchema.safeParse(parsed);
    if (safe.success) return safe.data;
  }
  return fallbackFromPack(analysisPack);
}

module.exports = { gerarInsightsGemini };
