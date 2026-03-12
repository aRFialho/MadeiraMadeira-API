// services/analiseAnuncioService.js
"use strict";

const BASE = "https://api.mercadolibre.com";

// Node 18+ tem fetch global; fallback pra node-fetch
const _fetch = typeof fetch !== "undefined" ? fetch : require("node-fetch");
const fetchRef = (...args) => _fetch(...args);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function datePart(d) {
  // YYYY-MM-DD (UTC)
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cleanZip(zip) {
  const z = String(zip || "").replace(/\D/g, "");
  if (z.length !== 8) return null;
  return z;
}

function inferPremium(listing_type_id) {
  const id = String(listing_type_id || "").toLowerCase();
  // Brasil normalmente: gold_pro = Premium; gold_special = Clássico
  return id === "gold_pro" || id === "gold_premium";
}

function pickSellerLocation(user) {
  const city =
    user?.address?.city || user?.address?.city_name || user?.city_name || null;

  const state =
    user?.address?.state ||
    user?.address?.state_name ||
    user?.state_name ||
    null;

  if (city && state) return `${city}/${state}`;
  if (city) return String(city);
  if (state) return String(state);
  return null;
}

async function mlGet(path, accessToken, qs = {}, retries = 3) {
  const url = new URL(BASE + path);

  Object.entries(qs || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    url.searchParams.set(k, String(v));
  });

  let lastErr;

  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetchRef(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const isJson = ct.includes("application/json");
      const body = isJson
        ? await r.json().catch(() => null)
        : await r.text().catch(() => "");

      if (!r.ok) {
        const err = new Error(
          (body && (body.message || body.error || body.cause)) ||
            `HTTP ${r.status} em ${path}`,
        );
        err.statusCode = r.status;

        if (r.status === 429 || r.status >= 500) {
          lastErr = err;
          await sleep(250 * (i + 1));
          continue;
        }
        throw err;
      }

      return body;
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) {
        await sleep(250 * (i + 1));
        continue;
      }
      throw lastErr;
    }
  }

  throw lastErr || new Error("Falha ao chamar ML API");
}

async function getVisits({ mlb, accessToken, dateFrom, dateTo }) {
  const attempts = [
    () =>
      mlGet(
        `/items/${encodeURIComponent(mlb)}/visits`,
        accessToken,
        { date_from: dateFrom, date_to: dateTo },
        2,
      ),
    () =>
      mlGet(
        `/visits/items`,
        accessToken,
        { ids: mlb, date_from: dateFrom, date_to: dateTo },
        2,
      ),
    () => mlGet(`/visits/items`, accessToken, { ids: mlb }, 2),
  ];

  for (const fn of attempts) {
    try {
      const v = await fn();

      if (v && typeof v.total_visits === "number") {
        return { total: v.total_visits, raw: v };
      }

      if (v && typeof v === "object" && v[mlb] != null) {
        const vv = v[mlb];
        if (typeof vv === "number") return { total: vv, raw: v };
        if (vv && typeof vv.total_visits === "number")
          return { total: vv.total_visits, raw: v };
      }

      if (Array.isArray(v)) {
        const row = v.find((x) => x && (x.id === mlb || x.item_id === mlb));
        if (row) {
          const n = row.total_visits ?? row.visits ?? row.total ?? null;
          if (typeof n === "number") return { total: n, raw: v };
        }
      }

      return { total: null, raw: v };
    } catch (_e) {}
  }

  return { total: null, raw: null };
}

async function getShipping({ mlb, accessToken, zip_code, item }) {
  const cleaned = cleanZip(zip_code);
  const base = {
    zip_code: cleaned,
    free_shipping: item?.shipping?.free_shipping ?? null,
    cost: null,
    logistic_type: item?.shipping?.logistic_type ?? null,
    mode: item?.shipping?.mode ?? null,
    raw: null,
  };

  if (!cleaned) return base;

  const attempts = [
    () =>
      mlGet(
        `/items/${encodeURIComponent(mlb)}/shipping_options`,
        accessToken,
        { zip_code: cleaned },
        2,
      ),
    () =>
      mlGet(
        `/items/${encodeURIComponent(mlb)}/shipping_options/free`,
        accessToken,
        { zip_code: cleaned },
        2,
      ),
  ];

  for (const fn of attempts) {
    try {
      const sh = await fn();
      base.raw = sh;

      const options =
        sh?.options ||
        sh?.shipping_options ||
        sh?.available_shipping_options ||
        null;

      if (Array.isArray(options) && options.length) {
        const costs = options
          .map((o) => Number(o?.cost ?? o?.list_cost ?? o?.base_cost))
          .filter((n) => Number.isFinite(n));

        if (costs.length) {
          const min = Math.min(...costs);
          base.cost = min;
          if (min === 0) base.free_shipping = true;
        }
      }

      return base;
    } catch (_e) {}
  }

  return base;
}

/**
 * ✅ FEES UNITÁRIO (Imposto/Recebe por 1 venda)
 * Endpoint oficial:
 *   /sites/{site_id}/listing_prices?price=...&listing_type_id=...&category_id=...
 *
 * Retorna valores tipo:
 *   sale_fee_amount, listing_fee_amount, etc
 */
async function getUnitFees({
  accessToken,
  siteId,
  price,
  categoryId,
  listingTypeId,
}) {
  if (!siteId || !price || !categoryId || !listingTypeId)
    return { ok: false, raw: null };

  const attempts = [
    () =>
      mlGet(
        `/sites/${encodeURIComponent(siteId)}/listing_prices`,
        accessToken,
        {
          price: Number(price),
          category_id: categoryId,
          listing_type_id: listingTypeId,
        },
        2,
      ),
  ];

  for (const fn of attempts) {
    try {
      const resp = await fn();
      const row =
        Array.isArray(resp?.listing_prices) && resp.listing_prices.length
          ? resp.listing_prices[0]
          : Array.isArray(resp) && resp.length
            ? resp[0]
            : resp;

      // tenta extrair padrões comuns
      const saleFee = Number(row?.sale_fee_amount);
      const listFee = Number(row?.listing_fee_amount);

      const sale_fee_amount = Number.isFinite(saleFee) ? saleFee : 0;
      const listing_fee_amount = Number.isFinite(listFee) ? listFee : 0;

      const total_fee = sale_fee_amount + listing_fee_amount;
      const net_receive = Number(price) - total_fee;

      return {
        ok: true,
        sale_fee_amount,
        listing_fee_amount,
        total_fee,
        net_receive: Number.isFinite(net_receive) ? net_receive : null,
        raw: resp,
      };
    } catch (_e) {}
  }

  return { ok: false, raw: null };
}

/**
 * ✅ ÚLTIMA VENDA (data/hora da venda mais recente do anúncio)
 * Precisa Orders:
 *   /orders/search?seller=...&item=...&sort=date_desc&limit=...
 *
 * A gente tenta filtrar por status pago/confirmado, mas se o filtro não pegar
 * (varia um pouco), a gente busca e escolhe o primeiro "paid/confirmed".
 */
async function getLastSale({ accessToken, sellerId, mlb }) {
  if (!sellerId || !mlb) return { last_sale_at: null, order: null, raw: null };

  const baseQs = {
    seller: sellerId,
    item: mlb,
    sort: "date_desc",
    limit: 10,
  };

  const attempts = [
    // tenta filtros comuns
    () =>
      mlGet(
        `/orders/search`,
        accessToken,
        { ...baseQs, "order.status": "paid" },
        2,
      ),
    () =>
      mlGet(
        `/orders/search`,
        accessToken,
        { ...baseQs, "order.status": "confirmed" },
        2,
      ),
    () =>
      mlGet(
        `/orders/search`,
        accessToken,
        { ...baseQs, "order.status": "paid,confirmed" },
        2,
      ),
    // fallback sem filtro
    () => mlGet(`/orders/search`, accessToken, { ...baseQs }, 2),
  ];

  for (const fn of attempts) {
    try {
      const resp = await fn();

      const results =
        resp?.results || resp?.orders || (Array.isArray(resp) ? resp : null);

      if (!Array.isArray(results) || !results.length) {
        return { last_sale_at: null, order: null, raw: resp };
      }

      const pick = (o) => {
        const status = String(o?.status || "").toLowerCase();
        return status === "paid" || status === "confirmed";
      };

      const order = results.find(pick) || results[0];

      const dt =
        order?.date_closed ||
        order?.date_created ||
        order?.date_last_updated ||
        null;

      return {
        last_sale_at: dt || null,
        order: order
          ? {
              id: order.id ?? null,
              status: order.status ?? null,
              date: dt || null,
            }
          : null,
        raw: resp,
      };
    } catch (_e) {}
  }

  return { last_sale_at: null, order: null, raw: null };
}

async function getRankEstimate({ accessToken, siteId, mlb, title }) {
  const q = encodeURIComponent(String(title || "").trim());
  if (!q) return { position: null, total: null, query: null, raw: null };
  let position = null;
  let total = null;
  let raw = [];
  const limit = 50;
  for (let offset = 0; offset < 200; offset += limit) {
    const url = `${BASE}/sites/${encodeURIComponent(siteId || "MLB")}/search?q=${q}&limit=${limit}&offset=${offset}`;
    const r = await fetchRef(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const j = await r.json().catch(() => null);
    if (!j || !Array.isArray(j.results)) break;
    if (total == null && Number.isFinite(j.paging?.total))
      total = j.paging.total;
    raw.push({ offset, items: j.results.map((it) => it?.id) });
    const idx = j.results.findIndex(
      (it) =>
        String(it?.id || "").toUpperCase() === String(mlb || "").toUpperCase(),
    );
    if (idx >= 0) {
      position = offset + idx + 1;
      break;
    }
    if (!j.results.length) break;
  }
  return { position, total, query: decodeURIComponent(q), raw };
}

async function getTrends({ siteId, categoryId }) {
  const url = `${BASE}/trends/${encodeURIComponent(siteId || "MLB")}/${encodeURIComponent(categoryId || "")}`;
  try {
    const r = await fetchRef(url, { headers: { Accept: "application/json" } });
    const j = await r.json().catch(() => null);
    const list = Array.isArray(j)
      ? j
      : Array.isArray(j?.trends)
        ? j.trends
        : [];
    return list
      .map((x) => ({
        keyword: String(x?.keyword || x?.value || "").trim(),
        url: x?.url || null,
        metric: x?.metric || null,
      }))
      .filter((x) => x.keyword);
  } catch {
    return [];
  }
}

async function getItemDescription({ mlb, accessToken }) {
  try {
    const desc = await mlGet(
      `/items/${encodeURIComponent(mlb)}/description`,
      accessToken,
      {},
      2,
    );
    const text = String(desc?.plain_text || desc?.text || "").trim();
    return { ok: true, text, raw: desc };
  } catch {
    return { ok: false, text: "", raw: null };
  }
}

function analyzeTextScanability(t) {
  const text = String(t || "");
  if (!text) return { length: 0, breaks: 0, bullets: 0, avgParagraph: 0 };
  const breaks = (text.match(/\n/g) || []).length;
  const bullets = (text.match(/(^|\n)\s*[\-\*\•]\s+/g) || []).length;
  const parts = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const avgParagraph = parts.length
    ? Math.round(parts.reduce((a, b) => a + b.length, 0) / parts.length)
    : 0;
  return { length: text.length, breaks, bullets, avgParagraph };
}

function scoreTitle(title, trends) {
  const t = String(title || "").trim();
  if (!t) return { clarity: 0, keywords: 0, seo: 0 };
  const len = t.length;
  let clarity = 0;
  if (len >= 45 && len <= 75) clarity = 95;
  else if (len >= 35 && len <= 90) clarity = 75;
  else if (len >= 25 && len <= 110) clarity = 55;
  else clarity = 30;
  const toks = t
    .toLowerCase()
    .split(/[^a-z0-9áàâãéêíóôõúç]+/i)
    .filter((x) => x.length >= 4);
  const uniq = Array.from(new Set(toks));
  let keywords = Math.min(100, uniq.length * 15);
  const kw = (trends || [])
    .map((x) => String(x?.keyword || "").toLowerCase())
    .filter(Boolean);
  const hasTrend = kw.some((k) => t.toLowerCase().includes(k));
  if (!hasTrend) keywords = Math.max(0, keywords - 25);
  const bad = [
    "imperdível",
    "promoção",
    "oferta",
    "melhor",
    "qualidade",
    "excelente",
  ];
  let penalty = bad.some((w) => t.toLowerCase().includes(w)) ? 20 : 0;
  let seo = Math.max(
    0,
    Math.min(100, Math.round(clarity * 0.5 + keywords * 0.5 - penalty)),
  );
  return { clarity, keywords, seo };
}

function scoreDescription(desc, attrs) {
  const s = analyzeTextScanability(desc);
  let estrutura = 0;
  if (s.length >= 1200) estrutura = 95;
  else if (s.length >= 800) estrutura = 80;
  else if (s.length >= 400) estrutura = 60;
  else if (s.length >= 200) estrutura = 40;
  else estrutura = 20;
  let esc = 0;
  if (s.bullets >= 3 && s.breaks >= 5 && s.avgParagraph <= 240) esc = 90;
  else if ((s.bullets >= 1 && s.breaks >= 3) || s.avgParagraph <= 300) esc = 70;
  else if (s.breaks >= 1) esc = 50;
  else esc = 30;
  const important = [
    "BRAND",
    "MODEL",
    "COLOR",
    "TAMANHO",
    "VOLTAGEM",
    "CAPACITY",
    "MARCA",
    "MODELO",
    "COR",
  ];
  const filled = Array.isArray(attrs)
    ? attrs.filter(
        (a) =>
          a &&
          a.id &&
          important.includes(String(a.id).toUpperCase()) &&
          String(a.value_name || a.value_id || a.value_string || "").trim(),
      ).length
    : 0;
  let info = 0;
  if (filled >= 4) info = 90;
  else if (filled >= 2) info = 70;
  else if (filled >= 1) info = 55;
  else info = 35;
  return { estrutura, escaneabilidade: esc, informacoes: info, scan: s };
}

function buildNegatives({ title, desc, trends, attrs }) {
  const negatives = [];
  const t = String(title || "");
  if (t.length < 30) negatives.push("título curto");
  if (t.length > 110) negatives.push("título muito longo");
  const kw = (trends || [])
    .map((x) => String(x?.keyword || "").toLowerCase())
    .filter(Boolean);
  const hasTrend = kw.length
    ? kw.some((k) => t.toLowerCase().includes(k))
    : null;
  if (hasTrend === false)
    negatives.push("título sem palavras-chave principais");
  const s = analyzeTextScanability(desc);
  if (s.length < 200) negatives.push("descrição curta");
  if (s.breaks <= 1 && s.bullets === 0) negatives.push("baixa escaneabilidade");
  const generic = [
    "qualidade",
    "melhor do mercado",
    "excelente",
    "imperdível",
    "oportunidade",
    "ótimo produto",
  ];
  if (
    generic.some((g) =>
      String(desc || "")
        .toLowerCase()
        .includes(g),
    )
  )
    negatives.push("excesso de texto genérico");
  const important = ["BRAND", "MODEL", "MARCA", "MODELO"];
  const filled = Array.isArray(attrs)
    ? attrs.filter(
        (a) =>
          a &&
          a.id &&
          important.includes(String(a.id).toUpperCase()) &&
          String(a.value_name || a.value_id || a.value_string || "").trim(),
      ).length
    : 0;
  if (filled < 2)
    negatives.push("ausência de informações técnicas importantes");
  return negatives;
}

module.exports = {
  async getOverview({ mlb, accessToken, days = 30, zip_code = null }) {
    const now = new Date();
    const dateTo = datePart(now);
    const from = new Date(now.getTime() - Number(days) * 24 * 60 * 60 * 1000);
    const dateFrom = datePart(from);

    // 1) Item (principal)
    const item = await mlGet(
      `/items/${encodeURIComponent(mlb)}`,
      accessToken,
      {},
      3,
    );

    // ✅ IMAGENS GRANDES (pra não ficar borrado)
    const pictures = Array.isArray(item?.pictures)
      ? item.pictures.map((p) => p?.secure_url || p?.url).filter(Boolean)
      : [];

    // 2) Seller
    const sellerId = item?.seller_id;
    let seller = null;

    if (sellerId) {
      seller = await mlGet(
        `/users/${encodeURIComponent(sellerId)}`,
        accessToken,
        {},
        3,
      );
    }

    // 3) Visits (janela)
    const visits = await getVisits({ mlb, accessToken, dateFrom, dateTo });

    // 4) Shipping (se tiver CEP)
    const shipping = await getShipping({ mlb, accessToken, zip_code, item });

    // 5) ✅ Fees unitário (Imposto/Recebe por 1 venda)
    const siteId = item?.site_id || "MLB";
    const feesUnit = await getUnitFees({
      accessToken,
      siteId,
      price: item?.price,
      categoryId: item?.category_id,
      listingTypeId: item?.listing_type_id,
    });

    // 6) ✅ Última venda (Orders)
    const lastSale = await getLastSale({ accessToken, sellerId, mlb });
    const descPack = await getItemDescription({ mlb, accessToken });

    // Resumo no formato que seu analise-ia.js renderiza
    const summary = {
      id: item?.id,
      title: item?.title,
      status: item?.status,
      permalink: item?.permalink,
      category_id: item?.category_id,
      condition: item?.condition,
      currency_id: item?.currency_id,

      price: item?.price ?? null,
      available_quantity: item?.available_quantity ?? null,
      sold_quantity: item?.sold_quantity ?? null,

      listing_type_id: item?.listing_type_id ?? null,
      catalog_listing: item?.catalog_listing ?? null,
      is_premium: inferPremium(item?.listing_type_id),

      // ✅ oficial store id vem do item
      official_store_id: item?.official_store_id ?? null,

      date_created: item?.date_created ?? null,
      last_updated: item?.last_updated ?? null,

      thumbnail:
        pictures[0] || item?.thumbnail || item?.secure_thumbnail || null,
      pictures,
    };

    const sellerOut = seller
      ? {
          seller_id: seller?.id ?? sellerId ?? null,
          nickname: seller?.nickname ?? null,
          location: pickSellerLocation(seller),
          // ✅ útil pro pill "Loja oficial" no front
          official_store: seller?.official_store ?? null,
        }
      : {
          seller_id: sellerId ?? null,
          nickname: null,
          location: null,
          official_store: null,
        };

    const sellerRep = seller?.seller_reputation || null;

    const rank = await getRankEstimate({
      accessToken,
      siteId,
      mlb,
      title: item?.title || "",
    });

    const trends = await getTrends({
      siteId,
      categoryId: item?.category_id || "",
    });

    const titleScores = scoreTitle(item?.title || "", trends);
    const descScores = scoreDescription(
      descPack.text || "",
      item?.attributes || [],
    );
    const subSeo = Math.round(
      titleScores.seo * 0.6 +
        descScores.estrutura * 0.2 +
        descScores.escaneabilidade * 0.2,
    );
    const palavrasChave = titleScores.keywords;
    const clarezaTitulo = titleScores.clarity;
    const estruturaDescricao = descScores.estrutura;
    const escaneabilidade = descScores.escaneabilidade;
    const informacoesTecnicas = descScores.informacoes;
    const overall = Math.round(
      subSeo * 0.35 +
        clarezaTitulo * 0.2 +
        estruturaDescricao * 0.15 +
        palavrasChave * 0.15 +
        escaneabilidade * 0.1 +
        informacoesTecnicas * 0.05,
    );
    const negatives = buildNegatives({
      title: item?.title || "",
      desc: descPack.text || "",
      trends,
      attrs: item?.attributes || [],
    });

    return {
      summary,
      visits: {
        total: visits.total,
        date_from: dateFrom,
        date_to: dateTo,
      },
      shipping: {
        zip_code: shipping.zip_code,
        free_shipping: shipping.free_shipping,
        cost: shipping.cost,
        logistic_type: shipping.logistic_type,
        mode: shipping.mode,
      },
      seller: sellerOut,
      seller_reputation: sellerRep,

      // ✅ NOVO: métricas pra preencher os cards faltando
      metrics: {
        unit: feesUnit?.ok
          ? {
              // “Imposto” = total de fee estimado do ML (por 1 venda)
              tax: feesUnit.total_fee,
              // “Recebe” = preço - fees (por 1 venda)
              receives: feesUnit.net_receive,
              // extras úteis
              sale_fee_amount: feesUnit.sale_fee_amount,
              listing_fee_amount: feesUnit.listing_fee_amount,
              currency_id: item?.currency_id || "BRL",
            }
          : {
              tax: null,
              receives: null,
              sale_fee_amount: null,
              listing_fee_amount: null,
              currency_id: item?.currency_id || "BRL",
            },

        // “Última venda”
        last_sale_at: lastSale.last_sale_at,
        ranking: {
          overall,
          breakdown: {
            seo: subSeo,
            estrutura_descricao: estruturaDescricao,
            clareza_titulo: clarezaTitulo,
            palavras_chave: palavrasChave,
            escaneabilidade,
            informacoes_tecnicas: informacoesTecnicas,
          },
        },
        negatives,
      },
      rank,
      trends,
      description: descPack.ok ? { text: descPack.text } : null,

      meta: {
        fetched_at: new Date().toISOString(),
      },
      raw: {
        item,
        seller,
        visits: visits.raw,
        shipping: shipping.raw,
        fees_unit: feesUnit.raw,
        last_sale: lastSale.raw,
        rank,
        trends,
        description: descPack.raw,
      },
    };
  },
};
