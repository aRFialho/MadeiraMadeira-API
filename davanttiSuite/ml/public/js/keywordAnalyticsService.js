const googleTrends = require("google-trends-api");
const _fetch = typeof fetch !== "undefined" ? fetch : require("node-fetch");
const fetchRef = (...args) => _fetch(...args);
const BASE = "https://api.mercadolibre.com";
const TokenService = require("../services/tokenService");

class KeywordAnalyticsService {
  static config = {
    googleTrends: {
      hl: "pt-BR",
      geo: "BR",
      timezone: -180,
      category: 0,
    },
  };

  /**
   * Busca dados de tendências do Google Trends para a palavra-chave.
   * Este método é agora o único método de busca neste serviço.
   * @param {string} keyword A palavra-chave principal.
   * @returns {Promise<Object>} Dados de palavras-chave relacionadas do Google Trends.
   */
  static async getGoogleTrendsKeywordData(keyword) {
    console.log(`📈 Buscando Google Trends para: "${keyword}"`);

    try {
      // Obter interesse ao longo do tempo para a palavra-chave principal
      const interestOverTime = await googleTrends.interestOverTime({
        keyword: keyword,
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias (ajustável)
        endTime: new Date(),
        geo: this.config.googleTrends.geo,
        hl: this.config.googleTrends.hl,
        timezone: this.config.googleTrends.timezone,
        category: this.config.googleTrends.category,
      });
      const interestData = JSON.parse(interestOverTime);

      // Obter consultas relacionadas
      const relatedQueries = await googleTrends.relatedQueries({
        keyword: keyword,
        geo: this.config.googleTrends.geo,
        hl: this.config.googleTrends.hl,
        timezone: this.config.googleTrends.timezone,
        category: this.config.googleTrends.category,
      });
      const relatedQueriesData = JSON.parse(relatedQueries);

      // Processar dados de interesse ao longo do tempo para tendência da palavra principal
      let trendMainKeyword = "estavel";
      if (
        interestData.default &&
        interestData.default.timelineData &&
        interestData.default.timelineData.length > 0
      ) {
        const values = interestData.default.timelineData.map((d) => d.value[0]);
        if (values.length > 7) {
          const firstWeekAvg =
            values.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
          const lastWeekAvg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
          const change =
            ((lastWeekAvg - firstWeekAvg) / (firstWeekAvg || 1)) * 100;

          if (change > 10) trendMainKeyword = "crescendo";
          else if (change < -10) trendMainKeyword = "declinando";
        }
      }

      // Construir lista de palavras-chave relacionadas
      const keywords = [];

      // Adicionar a palavra-chave principal
      keywords.push({
        keyword: keyword,
        interest:
          interestData.default.timelineData &&
          interestData.default.timelineData.length > 0
            ? interestData.default.timelineData[
                interestData.default.timelineData.length - 1
              ].value[0]
            : 0,
        trend: trendMainKeyword,
        isMainKeyword: true,
      });

      // Adicionar as consultas relacionadas (top e em ascensão)
      if (relatedQueriesData.default && relatedQueriesData.default.rankedList) {
        relatedQueriesData.default.rankedList.forEach((list) => {
          list.rankedKeyword.forEach((item) => {
            keywords.push({
              keyword: item.query,
              value: item.value,
              extractedValue: item.extractedValue,
              interest: item.value,
              trend:
                item.extractedValue === "Breakout" ? "crescendo" : "estavel",
              fromTrends: true, // Mantém a flag para indicar a fonte se for usar no futuro para híbrido
            });
          });
        });
      }

      const uniqueKeywords = Array.from(
        new Map(keywords.map((item) => [item.keyword, item])).values(),
      )
        .sort((a, b) => b.interest - a.interest)
        .slice(0, 20);

      return {
        source: "Google Trends", // A fonte agora é sempre Google Trends
        mainKeyword: keyword,
        relatedKeywords: uniqueKeywords,
      };
    } catch (error) {
      console.error(
        "❌ Erro na integração com Google Trends API:",
        error.message,
      );
      throw new Error(`Erro ao obter dados do Google Trends: ${error.message}`);
    }
  }

  static _cache = new Map();
  static _stop = new Set([
    "de",
    "do",
    "da",
    "e",
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "uns",
    "umas",
    "para",
    "com",
    "sem",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "por",
    "ao",
    "à",
    "às",
    "dos",
    "das",
    "que",
    "ou",
  ]);
  static _norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  static _toks(s) {
    return this._norm(s)
      .split(/[^a-z0-9]+/i)
      .filter((x) => x && x.length >= 2 && !this._stop.has(x));
  }
  static _jaccard(aArr, bArr) {
    const a = new Set(aArr || []);
    const b = new Set(bArr || []);
    const inter = [...a].filter((x) => b.has(x)).length;
    const uni = new Set([...a, ...b]).size;
    if (uni === 0) return 0;
    return inter / uni;
  }
  static async _mlGet(path, qs = {}, headers = {}) {
    const url = new URL(BASE + path);
    Object.entries(qs || {}).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    });
    const r = await fetchRef(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
    });
    try {
      const reqId =
        r.headers.get("x-request-id") ||
        r.headers.get("x-meli-request-id") ||
        null;
      console.log("KA ML response", {
        endpoint: path,
        status: r.status,
        meliRequestId: reqId || null,
      });
    } catch {}
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const isJson = ct.includes("application/json");
    const j = isJson
      ? await r.json().catch(() => null)
      : await r.text().catch(() => null);
    if (!r.ok) {
      const err = new Error(
        (j && (j.message || j.error)) || `HTTP ${r.status}`,
      );
      err.statusCode = r.status;
      err.endpoint = path;
      err.payload = typeof j === "string" ? j.slice(0, 300) : j;
      throw err;
    }
    return j;
  }
  static async _mlGetAuth(path, qs = {}, mlCreds = {}) {
    const url = new URL(BASE + path);
    Object.entries(qs || {}).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    });
    const call = async (token) => {
      const r = await fetchRef(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      try {
        const reqId =
          r.headers.get("x-request-id") ||
          r.headers.get("x-meli-request-id") ||
          null;
        console.log("KA ML response", {
          endpoint: path,
          status: r.status,
          meliRequestId: reqId || null,
        });
      } catch {}
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const isJson = ct.includes("application/json");
      const j = isJson
        ? await r.json().catch(() => null)
        : await r.text().catch(() => null);
      if (!r.ok) {
        const err = new Error(
          (j && (j.message || j.error)) || `HTTP ${r.status}`,
        );
        err.statusCode = r.status;
        err.endpoint = path;
        err.payload = typeof j === "string" ? j.slice(0, 300) : j;
        throw err;
      }
      return j;
    };
    const token = await TokenService.renovarTokenSeNecessario(mlCreds);
    try {
      return await call(token);
    } catch (e) {
      if (e.statusCode === 401) {
        const renewed = await TokenService.renovarToken(mlCreds);
        return await call(renewed.access_token);
      }
      throw e;
    }
  }
  static async _googleTrendScore(keyword) {
    try {
      const raw = await googleTrends.interestOverTime({
        keyword: keyword,
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endTime: new Date(),
        geo: this.config.googleTrends.geo,
        hl: this.config.googleTrends.hl,
        timezone: this.config.googleTrends.timezone,
        category: this.config.googleTrends.category,
      });
      const j = JSON.parse(raw);
      const vals = Array.isArray(j?.default?.timelineData)
        ? j.default.timelineData.map((d) => Number(d?.value?.[0] || 0))
        : [];
      if (!vals.length) return 0.5;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return Math.max(0, Math.min(1, avg / 100));
    } catch {
      return 0.5;
    }
  }
  static _competitionFromTotal(total) {
    const t = Number(total || 0);
    if (!Number.isFinite(t) || t <= 0) return 0;
    const comp = Math.log10(t) / Math.log10(1e6);
    return Math.max(0, Math.min(1, comp));
  }
  static async _rankForItem({ site, keyword, item_id, pages }) {
    let position = null;
    let total = null;
    const limit = 50;
    for (let offset = 0; offset < pages * limit; offset += limit) {
      const j = await this._mlGet(
        `/sites/${encodeURIComponent(site)}/search`,
        { q: keyword, limit, offset },
        {},
      );
      if (total == null && Number.isFinite(j?.paging?.total))
        total = j.paging.total;
      const results = Array.isArray(j?.results) ? j.results : [];
      const idx = results.findIndex(
        (it) =>
          String(it?.id || "").toUpperCase() === String(item_id).toUpperCase(),
      );
      if (idx >= 0) {
        position = offset + idx + 1;
        return { position, total };
      }
      if (!results.length) break;
    }
    return { position: null, total };
  }
  static async _serpTitles({ site, seed, headers }) {
    const j = await this._mlGet(
      `/sites/${encodeURIComponent(site)}/search`,
      { q: seed, limit: 50, offset: 0 },
      headers,
    );
    const titles = Array.isArray(j?.results)
      ? j.results.map((r) => r?.title).filter(Boolean)
      : [];
    return titles.slice(0, 50);
  }
  static _ngrams(toks, minN = 2, maxN = 4) {
    const out = [];
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= toks.length - n; i++) {
        out.push(toks.slice(i, i + n).join(" "));
      }
    }
    return out;
  }
  static _countFreq(arr) {
    const m = new Map();
    for (const s of arr) m.set(s, (m.get(s) || 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }
  static _attrsMap(attrs) {
    const out = {};
    for (const a of Array.isArray(attrs) ? attrs : []) {
      const id = String(a?.id || "").toUpperCase();
      const val = String(
        a?.value_name || a?.value_id || a?.value_string || "",
      ).trim();
      if (!val) continue;
      out[id] = val;
    }
    return out;
  }
  static _titleSuggestions({ keyword, item, attrs }) {
    const a = this._attrsMap(item?.attributes || attrs || []);
    const strong = a.BRAND || a.MARCA || a.MODEL || a.MODELO || "";
    const material = a.MATERIAL || "";
    const color = a.COLOR || a.COR || "";
    const cat = String(item?.category_id || "").toUpperCase();
    const base = [
      [keyword, strong, "oficial", a.MODEL || ""].filter(Boolean).join(" "),
      [keyword, material, color].filter(Boolean).join(" "),
      [keyword, "original", strong].filter(Boolean).join(" "),
      [keyword, "premium", strong].filter(Boolean).join(" "),
      [keyword, "com garantia", strong].filter(Boolean).join(" "),
    ];
    const uniq = Array.from(
      new Set(base.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean)),
    );
    return uniq.slice(0, 8);
  }
  static async computeSuggestions({
    item_id,
    seed,
    limit = 25,
    pages = 5,
    site = "MLB",
    accessToken,
    mlCreds,
    accountKey,
  }) {
    const key = `${item_id}:${this._norm(seed || "")}:${pages}:${limit}:${site}`;
    const hit = this._cache.get(key);
    const now = Date.now();
    if (hit && hit.exp > now) return hit.data;
    // Instrumentação: contexto + endpoint
    let sellerId = null, nickname = null;
    try {
      const t = await require("../services/tokenService").testarToken(mlCreds || {});
      if (t?.success) { sellerId = t.user_id || null; nickname = t.nickname || null; }
    } catch {}
    const hasAccessToken = !!(mlCreds && mlCreds.access_token);
    let tokenAgeSeconds = null;
    try {
      if (mlCreds && mlCreds.access_expires_at) {
        tokenAgeSeconds = Math.round((new Date(mlCreds.access_expires_at).getTime() - Date.now()) / 1000);
      }
    } catch {}
    console.log("KA ML request (pre)", {
      selectedAccountId: mlCreds?.meli_conta_id || null,
      sellerId,
      hasAccessToken,
      tokenAgeSeconds,
      endpoint: `/items/${encodeURIComponent(item_id)}`
    });
    // 1) Itens no ML são públicos — não enviar Authorization aqui para evitar 403 indevido
    const item = await this._mlGet(
      `/items/${encodeURIComponent(item_id)}`,
      {},
      {},
    );

    // 2) Validar token (para saber seller da conta selecionada) e diferenciar:
    //    - token inválido (401)
    //    - item não pertence à conta (403 ML_ITEM_NOT_OWNED)
    const t = await TokenService.testarToken(mlCreds || {});
    if (!t?.success || !t?.user_id) {
      const err = new Error("Token inválido/expirado para a conta selecionada");
      err.statusCode = 401;
      err.code = "ML_AUTH_INVALID";
      err.endpoint = "/users/me";
      throw err;
    }
    if (item?.seller_id && String(item.seller_id) !== String(t.user_id)) {
      const err = new Error("MLB não pertence à conta selecionada");
      err.statusCode = 403;
      err.code = "ML_ITEM_NOT_OWNED";
      err.endpoint = `/items/${encodeURIComponent(item_id)}`;
      err.details = { item_seller_id: item.seller_id, account_seller_id: t.user_id };
      throw err;
    }
    const seedUsed = seed && seed.trim() ? seed.trim() : item?.title || "";
    const baseToks = this._toks(item?.title || "");
    const attrToks = (Array.isArray(item?.attributes) ? item.attributes : [])
      .map((a) => this._toks(a?.value_name || a?.value_string || ""))
      .flat();
    const sourceA = seedUsed ? [this._norm(seedUsed)] : [];
    const sourceB = Array.from(new Set([...baseToks, ...attrToks])).filter(
      (x) => x.length >= 3,
    );
    console.log("KA ML request (pre)", {
      selectedAccountId: mlCreds?.meli_conta_id || null,
      sellerId,
      hasAccessToken,
      tokenAgeSeconds,
      endpoint: `/sites/${encodeURIComponent(site)}/search?q=${seedUsed}&limit=50&offset=0`
    });
    const serpTitles = seedUsed
      ? await this._serpTitles({ site, seed: seedUsed, headers: {} })
      : [];
    const ngrams = this._countFreq(
      this._ngrams(this._toks(serpTitles.join(" "))),
    );
    console.log("KA ML request (pre)", {
      selectedAccountId: mlCreds?.meli_conta_id || null,
      sellerId,
      hasAccessToken,
      tokenAgeSeconds,
      endpoint: `/trends/${encodeURIComponent(site)}`
    });
    const trends = await this._mlGet(
      `/trends/${encodeURIComponent(site)}`,
      {},
      {},
    );
    const trendKeywords = Array.isArray(trends?.trends)
      ? trends.trends
          .map((t) => String(t?.keyword || t?.value || "").trim())
          .filter(Boolean)
      : Array.isArray(trends)
        ? trends
            .map((t) => String(t?.keyword || t?.value || "").trim())
            .filter(Boolean)
        : [];
    const candidatesRaw = [
      ...sourceA,
      ...sourceB.map((x) => x),
      ...ngrams.slice(0, 80),
      ...trendKeywords.slice(0, 80),
    ].map(this._norm);
    const dedup = Array.from(new Set(candidatesRaw))
      .filter((s) => s && s.length >= 3 && !/^\d+$/.test(s))
      .slice(0, Math.max(limit * 4, 120));
    const out = [];
    const warnings = [];
    for (const kw of dedup) {
      let rankInfo = { position: null, total: null };
      try {
        rankInfo = await this._rankForItem({
          site,
          keyword: kw,
          item_id,
          pages,
        });
      } catch (e) {
        if (e.statusCode === 429) warnings.push("RATE_LIMIT");
      }
      const competition = this._competitionFromTotal(rankInfo.total);
      const trendScore = await this._googleTrendScore(kw);
      const relevance = this._jaccard(this._toks(kw), [
        ...baseToks,
        ...attrToks,
      ]);
      const rankScore = rankInfo.position
        ? Math.max(0, Math.min(1, 1 - (rankInfo.position - 1) / (pages * 50)))
        : 0;
      const score =
        0.45 * relevance +
        0.25 * trendScore +
        0.2 * (1 - competition) +
        0.1 * rankScore;
      out.push({
        keyword: kw,
        rank: rankInfo.position || null,
        rank_bucket: rankInfo.position
          ? `#${rankInfo.position}`
          : `> ${pages * 50}`,
        competition,
        trend: trendScore,
        relevance,
        score,
        title_suggestions: this._titleSuggestions({ keyword: kw, item }),
        debug: { total_results: rankInfo.total ?? null },
      });
      if (out.length >= limit) break;
    }
    out.sort((a, b) => b.score - a.score);
    const ranks = out.map((k) => k.rank).filter((r) => Number.isFinite(r));
    const avg_rank = ranks.length
      ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length)
      : null;
    const avg_competition = out.length
      ? out.reduce((a, b) => a + b.competition, 0) / out.length
      : 0;
    const avg_trend = out.length
      ? out.reduce((a, b) => a + b.trend, 0) / out.length
      : 0;
    const data = {
      item: {
        id: item?.id || item_id,
        title: item?.title || "",
        category_id: item?.category_id || null,
        price: item?.price ?? null,
        listing_type_id: item?.listing_type_id || null,
        status: item?.status || null,
        thumbnail: item?.thumbnail || item?.secure_thumbnail || null,
        permalink: item?.permalink || null,
      },
      seed_used: seedUsed,
      summary: {
        avg_rank,
        avg_competition,
        avg_trend,
        best_keyword: out[0]
          ? { keyword: out[0].keyword, score: out[0].score }
          : null,
      },
      keywords: out,
      warnings: warnings.length ? warnings : undefined,
    };
    this._cache.set(key, { exp: now + 6 * 60 * 60 * 1000, data });
    return data;
  }

  static clearCache() {
    this._cache = new Map();
  }
}

module.exports = KeywordAnalyticsService;
