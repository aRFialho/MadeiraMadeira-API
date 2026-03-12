"use strict";

const fetch = require("node-fetch");
const db = require("../db/db");
const ProductAdsService = require("./productAdsService");
const TokenService = require("./tokenService");

let XLSX = null;
try {
  XLSX = require("xlsx");
} catch (_err) {
  XLSX = null;
}

const ITEMS_URL = "https://api.mercadolibre.com/items";
const ORDERS_URL = "https://api.mercadolibre.com/orders/search";
const USERS_ME_URL = "https://api.mercadolibre.com/users/me";
const SHIPMENTS_URL = "https://api.mercadolibre.com/shipments";

function parseDateOnly(value) {
  const str = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : str;
}

function toISODate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function defaultRange(period = "30d") {
  const today = new Date();
  const to = toISODate(today);
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  return { date_from: toISODate(fromDate), date_to: to };
}

function normalizePeriod(period) {
  const allowed = new Set(["7d", "14d", "30d", "custom"]);
  return allowed.has(period) ? period : "30d";
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function maybeNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function textIncludes(value, term) {
  return String(value || "").toLowerCase().includes(term);
}

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function boolFromFilter(value) {
  if (value === true || value === false) return value;
  const s = normalizeString(value);
  if (["1", "true", "sim", "with", "com", "yes"].includes(s)) return true;
  if (["0", "false", "nao", "não", "without", "sem", "no"].includes(s)) return false;
  return null;
}

function clampPct(value) {
  if (!Number.isFinite(Number(value))) return 0;
  const n = Number(value);
  return Math.max(-99999, Math.min(99999, n));
}

function pick(obj, ...paths) {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path.split(".")) {
      if (cur == null || !(key in cur)) {
        ok = false;
        break;
      }
      cur = cur[key];
    }
    if (ok && cur != null) return cur;
  }
  return null;
}

async function mapWithLimit(items, limit, mapper) {
  const out = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (idx < items.length) {
      const current = idx++;
      out[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return out;
}

async function prepareAuth(opts = {}) {
  const creds = { ...opts.mlCreds, accountKey: opts.accountKey };
  const token = await TokenService.renovarTokenSeNecessario(creds);
  return { token, creds };
}

async function mlGetJson(url, state, retries = 1, headers = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${state.token}`,
          accept: "application/json",
          ...headers,
        },
      });
      const txt = await resp.text().catch(() => "");
      if (resp.status === 401 && attempt < retries) {
        const novo = await TokenService.renovarToken(state.creds);
        state.token = novo.access_token;
        continue;
      }
      if (!resp.ok) {
        const err = new Error(`HTTP ${resp.status} ${txt || url}`);
        err.httpStatus = resp.status;
        throw err;
      }
      return txt ? JSON.parse(txt) : {};
    } catch (err) {
      lastErr = err;
      if (attempt < retries) continue;
    }
  }
  throw lastErr;
}

async function fetchSellerInfo(state) {
  const me = await mlGetJson(USERS_ME_URL, state, 1);
  return {
    seller_id: me?.id,
    site_id: me?.site_id || me?.siteId || "MLB",
    nickname: me?.nickname || null,
  };
}

function extractCatalogProductId(body) {
  const attrs = Array.isArray(body?.attributes) ? body.attributes : [];
  const attr = attrs.find((a) => String(a?.id || "").toUpperCase() === "CATALOG_PRODUCT_ID");
  return attr?.value_id || attr?.value_name || null;
}

async function fetchItemsMap(itemIds, state) {
  const ids = Array.from(new Set((itemIds || []).filter(Boolean)));
  const out = new Map();
  const chunkSize = 20;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const qs = new URLSearchParams();
    qs.set("ids", slice.join(","));
    qs.set(
      "attributes",
      [
        "id",
        "title",
        "thumbnail",
        "secure_thumbnail",
        "seller_custom_field",
        "price",
        "original_price",
        "status",
        "catalog_listing",
        "available_quantity",
        "inventory_id",
        "shipping",
        "date_created",
        "permalink",
        "health",
        "attributes",
        "variation_id",
      ].join(",")
    );

    const rows = await mlGetJson(`${ITEMS_URL}?${qs.toString()}`, state, 1).catch(() => []);
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || row.code !== 200 || !row.body?.id) continue;
      const body = row.body;
      const attrs = Array.isArray(body.attributes) ? body.attributes : [];
      const skuAttr = attrs.find((a) => ["SELLER_SKU", "SKU"].includes(String(a?.id || "").toUpperCase()));
      const sellerSku =
        body.seller_custom_field ||
        skuAttr?.value_name ||
        skuAttr?.value_id ||
        (Array.isArray(skuAttr?.values) ? skuAttr.values[0]?.name : null) ||
        null;
      const healthRaw = body.health;
      const publicationQuality =
        Number.isFinite(Number(healthRaw))
          ? Number(healthRaw) <= 1
            ? Math.round(Number(healthRaw) * 100)
            : Math.round(Number(healthRaw))
          : null;

      out.set(String(body.id), {
        item_id: String(body.id),
        title: body.title || null,
        thumbnail: body.secure_thumbnail || body.thumbnail || null,
        sku: sellerSku,
        price: numberOrZero(body.price),
        original_price: numberOrZero(body.original_price),
        status: body.status || null,
        catalog_listing: !!body.catalog_listing,
        catalog_product_id: extractCatalogProductId(body),
        stock: numberOrZero(body.available_quantity),
        inventory_id: body.inventory_id || null,
        shipping_logistic_type: body?.shipping?.logistic_type || null,
        date_created: body.date_created || null,
        permalink: body.permalink || null,
        publication_quality: publicationQuality,
        variation_id: body.variation_id || null,
      });
    }
  }

  return out;
}

async function fetchOrdersByStatus({ sellerId, dateFrom, dateTo, status, state, maxPages = 80 }) {
  const results = [];
  const limit = 50;
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(ORDERS_URL);
    url.searchParams.set("seller", String(sellerId));
    url.searchParams.set("order.status", status);
    url.searchParams.set("order.date_created.from", `${dateFrom}T00:00:00.000-03:00`);
    url.searchParams.set("order.date_created.to", `${dateTo}T23:59:59.999-03:00`);
    url.searchParams.set("sort", "date_desc");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const data = await mlGetJson(url.toString(), state, 1).catch(() => null);
    if (!data) break;
    const rows = Array.isArray(data.results) ? data.results : [];
    results.push(...rows);
    offset += rows.length;
    if (!rows.length) break;
    if (offset >= numberOrZero(data?.paging?.total)) break;
    if (rows.length < limit) break;
  }

  return results;
}

function orderItems(order) {
  return Array.isArray(order?.order_items) ? order.order_items : [];
}

function extractShipmentId(order) {
  return pick(order, "shipping.id", "shipping.shipment_id", "shipment.id", "shipping.id_str");
}

async function fetchShipmentCostsMap(orders, state) {
  const ids = Array.from(new Set(orders.map(extractShipmentId).filter(Boolean)));
  const map = new Map();
  await mapWithLimit(ids, 5, async (shipmentId) => {
    try {
      const shipment = await mlGetJson(`${SHIPMENTS_URL}/${shipmentId}`, state, 1, { "x-format-new": "true" }).catch(() => null);
      const costs = await mlGetJson(`${SHIPMENTS_URL}/${shipmentId}/costs`, state, 1).catch(() => null);
      map.set(String(shipmentId), { shipment, costs });
    } catch {
      map.set(String(shipmentId), { shipment: null, costs: null });
    }
  });
  return map;
}

function parseShipmentSellerCost(costs, shipment) {
  return numberOrZero(
    pick(
      costs,
      "gross_amount",
      "receiver.cost",
      "senders[0].cost",
      "senders_cost",
      "senders_cost.amount",
      "costs.receiver.amount",
      "costs.sender.amount"
    ) ||
      pick(
        shipment,
        "shipping_option.cost",
        "cost_components.sender_cost",
        "cost_components.receiver_cost"
      )
  );
}

function parseShipmentMode(shipment, order) {
  return normalizeString(pick(shipment, "logistic.mode", "mode", "type") || pick(order, "shipping.logistic_type", "shipping.mode"));
}

function parseBonification(order, oi) {
  return numberOrZero(
    pick(
      oi,
      "rebate.amount",
      "benefits.meli_coupon.amount",
      "benefits.discount.amount",
      "discount_info.seller_compensation.amount",
      "discount_info.compensation.amount",
      "discounts[0].seller_compensation.amount",
      "discounts[0].rebate.amount",
      "sale_fee_rebate",
      "promotion_rebate"
    ) ||
      pick(
        order,
        "discount_info.seller_compensation.amount",
        "coupon.amount",
        "coupon_amount",
        "discount.amount",
        "discount_info.rebate.amount"
      )
  );
}

function aggregateOrdersByItem(orders = [], shipmentMap = new Map()) {
  const map = new Map();

  for (const order of orders) {
    const items = orderItems(order);
    const shipmentId = extractShipmentId(order);
    const shipmentData = shipmentId ? shipmentMap.get(String(shipmentId)) : null;
    const shipmentCostTotal = parseShipmentSellerCost(shipmentData?.costs, shipmentData?.shipment);
    const shipmentMode = parseShipmentMode(shipmentData?.shipment, order);
    const hasMe2Like = shipmentMode.includes("me2") || shipmentMode.includes("collection") || shipmentMode.includes("cross_docking") || shipmentMode.includes("drop_off") || shipmentMode.includes("fulfillment");
    const orderGross = items.reduce((sum, oi) => sum + numberOrZero(oi?.unit_price || oi?.full_unit_price) * numberOrZero(oi?.quantity || 1), 0);

    for (const oi of items) {
      const itemId = String(oi?.item?.id || oi?.item?.item_id || "");
      if (!itemId) continue;
      const quantity = numberOrZero(oi?.quantity || 1);
      const gross = numberOrZero(oi?.unit_price || oi?.full_unit_price) * quantity;
      const fee = numberOrZero(oi?.sale_fee) * quantity;
      const shippingShare = hasMe2Like && orderGross > 0 ? shipmentCostTotal * (gross / orderGross) : 0;
      const bonificationShare = parseBonification(order, oi);

      const cur = map.get(itemId) || {
        units: 0,
        gross: 0,
        costOfPublication: 0,
        shippingCost: 0,
        bonification: 0,
        cancelledUnits: 0,
        cancelledGross: 0,
      };

      cur.units += quantity;
      cur.gross += gross;
      cur.costOfPublication += fee;
      cur.shippingCost += shippingShare;
      cur.bonification += bonificationShare;
      map.set(itemId, cur);
    }
  }

  return map;
}

function aggregateCancelledByItem(orders = []) {
  const map = new Map();
  for (const order of orders) {
    for (const oi of orderItems(order)) {
      const itemId = String(oi?.item?.id || oi?.item?.item_id || "");
      if (!itemId) continue;
      const quantity = numberOrZero(oi?.quantity || 1);
      const gross = numberOrZero(oi?.unit_price || oi?.full_unit_price) * quantity;
      const cur = map.get(itemId) || { cancelledUnits: 0, cancelledGross: 0 };
      cur.cancelledUnits += quantity;
      cur.cancelledGross += gross;
      map.set(itemId, cur);
    }
  }
  return map;
}

function computeCurveByRevenue(items) {
  const valid = items.slice().sort((a, b) => numberOrZero(b.faturamento) - numberOrZero(a.faturamento));
  const total = valid.reduce((sum, item) => sum + numberOrZero(item.faturamento), 0) || 1;
  let acc = 0;
  for (const item of valid) {
    acc += numberOrZero(item.faturamento);
    const share = acc / total;
    item.curva = share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C";
  }
}

function buildSummary(items) {
  const totals = items.reduce(
    (acc, item) => {
      acc.faturamento_bruto += numberOrZero(item.faturamento_bruto);
      acc.faturamento_liquido += numberOrZero(item.faturamento);
      acc.vendas_canceladas += numberOrZero(item.vendas_canceladas_valor);
      acc.taxa_vendas += numberOrZero(item.custo_publicacao);
      acc.investimento += numberOrZero(item.investimento);
      acc.impostos += numberOrZero(item.impostos);
      acc.custo_envio += numberOrZero(item.custo_envio);
      acc.custo_produto += numberOrZero(item.custo_produto);
      acc.custo_devolucao += numberOrZero(item.custo_devolucao);
      acc.margem_contribuicao += numberOrZero(item.margem_contribuicao);
      return acc;
    },
    {
      faturamento_bruto: 0,
      faturamento_liquido: 0,
      vendas_canceladas: 0,
      taxa_vendas: 0,
      investimento: 0,
      impostos: 0,
      custo_envio: 0,
      custo_produto: 0,
      custo_devolucao: 0,
      margem_contribuicao: 0,
    }
  );

  const margemPct = totals.faturamento_liquido > 0 ? (totals.margem_contribuicao / totals.faturamento_liquido) * 100 : 0;
  return {
    ...totals,
    margem_contribuicao_pct: margemPct,
    anuncios: items.length,
  };
}

function normalizeFamilyTitle(title) {
  return String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(preto|branco|bege|caramelo|cinza|marrom|azul|verde|rosa|roxo|vermelho|amarelo|laranja|grafite|nozes|nogueira|freijo|off\s*white)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function computeFamilyKey(item) {
  return item.inventory_id || item.catalog_product_id || normalizeFamilyTitle(item.title).slice(0, 80) || item.item_id;
}

function aggregateGroupedItems(items) {
  const groups = new Map();
  for (const item of items) {
    const key = computeFamilyKey(item);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...item, group_key: key, group_size: 1 });
      continue;
    }
    current.group_size += 1;
    const keysToSum = ["unidades_vendidas","faturamento_bruto","faturamento","vendas_canceladas_valor","vendas_canceladas_qtd","bonificacoes","custo_produto","custo_publicacao","custo_envio","custo_devolucao","investimento","impostos","margem_contribuicao","margem_sem_publicidade","clicks","impressoes","estoque"];
    keysToSum.forEach((k)=> current[k] = numberOrZero(current[k]) + numberOrZero(item[k]));
    current.ticket_medio = current.unidades_vendidas > 0 ? current.faturamento / current.unidades_vendidas : 0;
    current.roas = current.investimento > 0 ? current.faturamento / current.investimento : 0;
    current.mc_pct = current.faturamento > 0 ? (current.margem_contribuicao / current.faturamento) * 100 : 0;
    current.mc_sem_ads_pct = current.faturamento > 0 ? (current.margem_sem_publicidade / current.faturamento) * 100 : 0;
    current.publicidade = current.publicidade || item.publicidade;
    current.full = current.full || item.full;
    current.catalog = current.catalog || item.catalog;
    current.has_active_promotion = current.has_active_promotion || item.has_active_promotion;
    current.title = current.title || item.title;
  }
  return Array.from(groups.values()).map((item) => ({
    ...item,
    title: item.group_size > 1 ? `${item.title} (+${item.group_size - 1})` : item.title,
  }));
}

function parseNumericCell(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const txt = String(value).trim();
  if (!txt) return null;
  const cleaned = txt.replace(/r\$/gi, "").replace(/%/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/\s+/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeUploadHeaders(row = {}) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeFamilyTitle(key).replace(/\s+/g, "_");
    out[normalized] = value;
  }
  return out;
}

function parseUploadRowsFromBase64(filename, contentBase64) {
  if (!contentBase64) throw new Error("Arquivo não enviado.");
  const buffer = Buffer.from(String(contentBase64), "base64");

  if (/\.csv$/i.test(String(filename || ""))) {
    const lines = buffer.toString("utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const [headerLine, ...rest] = lines;
    const headers = headerLine.split(/[;,\t]+/g).map((h) => normalizeFamilyTitle(h).replace(/\s+/g, "_"));
    return rest.map((line) => {
      const cols = line.split(/[;,\t]+/g);
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });
      return row;
    });
  }

  if (!XLSX) throw new Error("Dependência xlsx não instalada. Rode npm install na pasta ml.");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const first = workbook.SheetNames[0];
  if (!first) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[first], { defval: "" });
}

async function getConfigMap(accountKey, itemIds) {
  const ids = Array.from(new Set((itemIds || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (!ids.length) return new Map();
  const { rows } = await db.query(
    `select item_id, custo_produto_unitario, aliquota from rentabilidade_item_configs where account_key = $1 and item_id = any($2::text[])`,
    [String(accountKey || ""), ids]
  );
  return new Map(rows.map((row) => [String(row.item_id), row]));
}

async function upsertConfig({ accountKey, sellerId, itemId, custoProdutoUnitario, aliquota, userId, source = "manual", meta = {} }) {
  const custo = maybeNumber(custoProdutoUnitario);
  const tax = maybeNumber(aliquota);
  if (!itemId) throw new Error("item_id é obrigatório.");

  return db.withClient(async (client) => {
    await client.query("begin");
    try {
      const upsert = await client.query(
        `insert into rentabilidade_item_configs (account_key, seller_id, item_id, custo_produto_unitario, aliquota, updated_by) values ($1,$2,$3,coalesce($4,0),coalesce($5,0),$6)
         on conflict (account_key, item_id)
         do update set seller_id = excluded.seller_id, custo_produto_unitario = coalesce(excluded.custo_produto_unitario, rentabilidade_item_configs.custo_produto_unitario), aliquota = coalesce(excluded.aliquota, rentabilidade_item_configs.aliquota), updated_by = excluded.updated_by, updated_at = now()
         returning *`,
        [String(accountKey || ""), sellerId || null, String(itemId), custo, tax, userId || null]
      );
      const saved = upsert.rows[0];
      await client.query(
        `insert into rentabilidade_item_config_history (config_id, account_key, seller_id, item_id, custo_produto_unitario, aliquota, source, changed_by, meta) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [saved.id, saved.account_key, saved.seller_id, saved.item_id, saved.custo_produto_unitario, saved.aliquota, source, userId || null, JSON.stringify(meta || {})]
      );
      await client.query("commit");
      return saved;
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  });
}

async function getConfigHistory(accountKey, itemId, limit = 20) {
  const { rows } = await db.query(
    `select id, item_id, custo_produto_unitario, aliquota, source, changed_by, created_at, meta from rentabilidade_item_config_history where account_key = $1 and item_id = $2 order by id desc limit $3`,
    [String(accountKey || ""), String(itemId), Math.max(1, Math.min(100, Number(limit) || 20))]
  );
  return rows;
}

class RentabilidadeService {
  static resolveFilters(query = {}) {
    const period = normalizePeriod(String(query.period || "30d"));
    const q = String(query.q || query.search || "").trim();
    const campaign_id = String(query.campaign_id || "").trim();

    let range = defaultRange(period);
    if (period === "custom") {
      const from = parseDateOnly(query.date_from);
      const to = parseDateOnly(query.date_to);
      if (from && to) range = from <= to ? { date_from: from, date_to: to } : { date_from: to, date_to: from };
    }

    return {
      period,
      q,
      campaign_id,
      margin_filter: String(query.margin_filter || "all"),
      sales_filter: String(query.sales_filter || "all"),
      item_status: String(query.item_status || "active"),
      curve: String(query.curve || "all"),
      publicidade: String(query.publicidade || "all"),
      ad_status: String(query.ad_status || "all"),
      full: String(query.full || "all"),
      catalog: String(query.catalog || "all"),
      classify_by_variation: boolFromFilter(query.classify_by_variation) === true,
      only_without_product_cost: boolFromFilter(query.only_without_product_cost),
      group_by_family: boolFromFilter(query.group_by_family) === true,
      page: Math.max(1, Number(query.page) || 1),
      page_size: 25,
      date_from: range.date_from,
      date_to: range.date_to,
    };
  }

  static async obterOverview(filters, options = {}) {
    const state = await prepareAuth(options);
    const sellerInfo = await fetchSellerInfo(state).catch(() => ({ seller_id: null, site_id: "MLB", nickname: null }));

    const campaignsResult = await ProductAdsService.listarCampanhas({ date_from: filters.date_from, date_to: filters.date_to }, options);
    if (!campaignsResult?.success) return campaignsResult;

    const campaigns = Array.isArray(campaignsResult.campaigns) ? campaignsResult.campaigns : [];
    const filteredCampaigns = filters.campaign_id ? campaigns.filter((campaign) => String(campaign.id) === filters.campaign_id) : campaigns;

    const campaignItems = await mapWithLimit(filteredCampaigns, 3, async (campaign) => {
      const itemsResult = await ProductAdsService.listarItensCampanha(campaign.id, { date_from: filters.date_from, date_to: filters.date_to }, options);
      if (!itemsResult?.success) return [];
      return (Array.isArray(itemsResult.items) ? itemsResult.items : []).map((item) => ({ ...item, campaign_id: campaign.id, campaign_name: campaign.name || `Campanha ${campaign.id}`, campaign_status: campaign.status || "—", campaign_strategy: campaign.strategy || null }));
    });

    const baseItems = campaignItems.flat();
    const itemIds = baseItems.map((item) => item.item_id);
    const [itemMap, configMap] = await Promise.all([fetchItemsMap(itemIds, state), getConfigMap(options.accountKey, itemIds).catch(() => new Map())]);

    let paidOrdersByItem = new Map();
    let cancelledOrdersByItem = new Map();
    if (sellerInfo.seller_id) {
      const [paidOrders, cancelledOrders] = await Promise.all([
        fetchOrdersByStatus({ sellerId: sellerInfo.seller_id, dateFrom: filters.date_from, dateTo: filters.date_to, status: "paid", state }).catch(() => []),
        fetchOrdersByStatus({ sellerId: sellerInfo.seller_id, dateFrom: filters.date_from, dateTo: filters.date_to, status: "cancelled", state, maxPages: 20 }).catch(() => []),
      ]);
      const shipmentMap = await fetchShipmentCostsMap(paidOrders, state).catch(() => new Map());
      paidOrdersByItem = aggregateOrdersByItem(paidOrders, shipmentMap);
      cancelledOrdersByItem = aggregateCancelledByItem(cancelledOrders);
    }

    const daysInRange = Math.max(1, Math.round((new Date(`${filters.date_to}T00:00:00`).getTime() - new Date(`${filters.date_from}T00:00:00`).getTime()) / 86400000) + 1);

    let items = baseItems.map((item) => {
      const detail = itemMap.get(String(item.item_id)) || {};
      const savedConfig = configMap.get(String(item.item_id)) || {};
      const paidAgg = paidOrdersByItem.get(String(item.item_id)) || {};
      const cancelledAgg = cancelledOrdersByItem.get(String(item.item_id)) || {};
      const metrics = item.metrics || {};

      const faturamentoBruto = numberOrZero(metrics.total_amount) || numberOrZero(paidAgg.gross);
      const vendasCanceladasValor = numberOrZero(cancelledAgg.cancelledGross);
      const faturamento = Math.max(0, faturamentoBruto - vendasCanceladasValor);
      const unidadesVendidas = numberOrZero(metrics.units_quantity) || numberOrZero(paidAgg.units);
      const ticketMedio = unidadesVendidas > 0 ? faturamento / unidadesVendidas : 0;
      const investimento = numberOrZero(metrics.cost);
      const custoPublicacao = numberOrZero(paidAgg.costOfPublication);
      const custoEnvio = numberOrZero(paidAgg.shippingCost);
      const custoProdutoUnitario = numberOrZero(savedConfig.custo_produto_unitario);
      const custoProduto = custoProdutoUnitario * unidadesVendidas;
      const aliquota = numberOrZero(savedConfig.aliquota);
      const impostos = faturamento * (aliquota / 100);
      const custoDevolucao = 0;
      const bonificacoes = numberOrZero(paidAgg.bonification);
      const margem = faturamento - (custoProduto + custoPublicacao + custoEnvio + custoDevolucao + investimento + impostos) + bonificacoes;
      const margemSemAds = margem + investimento;
      const mcPct = faturamento > 0 ? (margem / faturamento) * 100 : 0;
      const mcSemAdsPct = faturamento > 0 ? (margemSemAds / faturamento) * 100 : 0;
      const stock = numberOrZero(detail.stock);
      const daysPublished = detail.date_created ? Math.max(0, Math.round((Date.now() - new Date(detail.date_created).getTime()) / 86400000)) : null;
      const daysWithStock = unidadesVendidas > 0 ? Math.round(stock / (unidadesVendidas / daysInRange)) : null;
      const hasAds = investimento > 0;
      const isFull = normalizeString(detail.shipping_logistic_type) === "fulfillment";
      const catalog = !!detail.catalog_listing;
      const quality = Number.isFinite(Number(detail.publication_quality)) ? Number(detail.publication_quality) : Number.isFinite(Number(item.publication_quality)) ? Number(item.publication_quality) : null;

      return {
        item_id: String(item.item_id),
        title: detail.title || item.title || item.item_id,
        sku: detail.sku || item.sku || null,
        status: detail.status || item.status || "—",
        thumbnail: detail.thumbnail || item.thumbnail || null,
        publication_quality: quality,
        campaign_id: item.campaign_id,
        campaign_name: item.campaign_name,
        campaign_status: item.campaign_status,
        faturamento_bruto: faturamentoBruto,
        faturamento,
        vendas_canceladas_valor: vendasCanceladasValor,
        vendas_canceladas_qtd: numberOrZero(cancelledAgg.cancelledUnits),
        bonificacoes,
        unidades_vendidas: unidadesVendidas,
        ticket_medio: ticketMedio,
        custo_produto_unitario: custoProdutoUnitario,
        custo_produto: custoProduto,
        aliquota,
        custo_publicacao: custoPublicacao,
        custo_envio: custoEnvio,
        custo_devolucao: custoDevolucao,
        investimento,
        impostos,
        margem_contribuicao: margem,
        margem_sem_publicidade: margemSemAds,
        mc_pct: clampPct(mcPct),
        mc_sem_ads_pct: clampPct(mcSemAdsPct),
        share_lucro: 0,
        estoque: stock,
        duracao_estoque: Number.isFinite(daysWithStock) ? daysWithStock : null,
        roas: numberOrZero(metrics.roas) || (investimento > 0 ? faturamento / investimento : 0),
        acos: numberOrZero(metrics.acos),
        ctr: numberOrZero(metrics.ctr),
        cpc: numberOrZero(metrics.cpc),
        clicks: numberOrZero(metrics.clicks),
        impressoes: numberOrZero(metrics.prints),
        curva: null,
        has_active_promotion: detail.price > 0 && detail.original_price > detail.price,
        publicidade: hasAds,
        full: isFull,
        catalog,
        catalog_product_id: detail.catalog_product_id || null,
        inventory_id: detail.inventory_id || null,
        family_key: computeFamilyKey({ ...detail, title: detail.title || item.title, item_id: item.item_id }),
        price: numberOrZero(detail.price),
        original_price: numberOrZero(detail.original_price),
        permalink: detail.permalink || null,
        variation_id: detail.variation_id || item.variation_id || null,
        days_published: daysPublished,
        days_in_range: daysInRange,
        seller_id: sellerInfo.seller_id,
      };
    });

    computeCurveByRevenue(items);
    const totalMargin = items.reduce((sum, item) => sum + numberOrZero(item.margem_contribuicao), 0);
    items = items.map((item) => ({ ...item, share_lucro: totalMargin !== 0 ? (numberOrZero(item.margem_contribuicao) / totalMargin) * 100 : 0 }));

    if (!filters.classify_by_variation) {
      const dedup = new Map();
      for (const item of items) {
        const key = String(item.item_id || "");
        const current = dedup.get(key);
        if (!current) {
          dedup.set(key, item);
          continue;
        }

        const currentFat = numberOrZero(current.faturamento);
        const nextFat = numberOrZero(item.faturamento);
        if (nextFat > currentFat) {
          dedup.set(key, item);
          continue;
        }

        if (nextFat === currentFat) {
          const currentInv = numberOrZero(current.investimento);
          const nextInv = numberOrZero(item.investimento);
          if (nextInv > currentInv) {
            dedup.set(key, item);
            continue;
          }

          if (nextInv === currentInv) {
            const currentCampaign = String(current.campaign_name || "");
            const nextCampaign = String(item.campaign_name || "");
            if (nextCampaign.localeCompare(currentCampaign, "pt-BR") < 0) {
              dedup.set(key, item);
            }
          }
        }
      }
      items = Array.from(dedup.values());
    }

    if (filters.group_by_family) {
      items = aggregateGroupedItems(items);
      computeCurveByRevenue(items);
    }

    const totalMarginAfterGrouping = items.reduce((sum, item) => sum + numberOrZero(item.margem_contribuicao), 0);
    items = items.map((item) => ({ ...item, share_lucro: totalMarginAfterGrouping !== 0 ? (numberOrZero(item.margem_contribuicao) / totalMarginAfterGrouping) * 100 : 0 }));

    if (filters.q) {
      const term = filters.q.toLowerCase();
      items = items.filter((item) => textIncludes(item.title, term) || textIncludes(item.item_id, term) || textIncludes(item.sku, term) || textIncludes(item.campaign_name, term));
    }

    items = items.filter((item) => {
      if (filters.margin_filter === "positive" && !(item.margem_contribuicao > 0)) return false;
      if (filters.margin_filter === "negative" && !(item.margem_contribuicao < 0)) return false;
      if (filters.sales_filter === "with_sales" && !(item.unidades_vendidas > 0)) return false;
      if (filters.sales_filter === "without_sales" && !(item.unidades_vendidas === 0)) return false;
      if (filters.item_status !== "all" && normalizeString(item.status) !== normalizeString(filters.item_status)) return false;
      if (filters.curve !== "all" && String(item.curva || "") !== String(filters.curve)) return false;
      if (filters.publicidade === "with_ads" && !item.publicidade) return false;
      if (filters.publicidade === "without_ads" && item.publicidade) return false;
      if (filters.ad_status !== "all" && normalizeString(item.campaign_status) !== normalizeString(filters.ad_status)) return false;
      if (filters.full === "with_full" && !item.full) return false;
      if (filters.full === "without_full" && item.full) return false;
      if (filters.catalog === "with_catalog" && !item.catalog) return false;
      if (filters.catalog === "without_catalog" && item.catalog) return false;
      if (filters.only_without_product_cost === true && !(numberOrZero(item.custo_produto_unitario) <= 0)) return false;
      return true;
    });

    items.sort((a, b) => {
      const faturamentoDiff = numberOrZero(b.faturamento) - numberOrZero(a.faturamento);
      if (faturamentoDiff !== 0) return faturamentoDiff;
      return String(a.title || "").localeCompare(String(b.title || ""), "pt-BR");
    });

    const summary = buildSummary(items);
    return {
      success: true,
      filters,
      summary,
      campaigns: campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, status: campaign.status })),
      items,
      meta: {
        source: "product_ads",
        total_campaigns: campaigns.length,
        total_items: items.length,
        seller_id: sellerInfo.seller_id,
        seller_nickname: sellerInfo.nickname,
        page: filters.page,
        page_size: filters.page_size,
        note: "Colunas ampliadas com base nos dados disponíveis em Product Ads, Items, Orders e Shipments da API pública do Mercado Livre.",
      },
    };
  }

  static async salvarConfiguracao({ accountKey, sellerId, itemId, custo_produto_unitario, aliquota, userId, source = "manual", meta = {} }) {
    const saved = await upsertConfig({ accountKey, sellerId, itemId, custoProdutoUnitario: custo_produto_unitario, aliquota, userId, source, meta });
    return { success: true, config: { item_id: saved.item_id, custo_produto_unitario: numberOrZero(saved.custo_produto_unitario), aliquota: numberOrZero(saved.aliquota), updated_at: saved.updated_at } };
  }

  static async historicoConfiguracao({ accountKey, itemId, limit = 20 }) {
    const rows = await getConfigHistory(accountKey, itemId, limit);
    return { success: true, history: rows };
  }

  static async importarConfiguracoes({ accountKey, sellerId, filename, content_base64, userId }) {
    const rawRows = parseUploadRowsFromBase64(filename, content_base64);
    const parsed = rawRows
      .map((row) => normalizeUploadHeaders(row))
      .map((row) => ({
        item_id: String(row.item_id || row.mlb || row.id || row.anuncio || row.item || "").trim().toUpperCase(),
        custo_produto_unitario: parseNumericCell(row.custo_produto_unitario || row.custo || row.custo_do_produto || row.carga_de_custos_do_produto),
        aliquota: parseNumericCell(row.aliquota || row.aliquota_percentual || row.carga_de_aliquota || row.impostos),
      }))
      .filter((row) => row.item_id && (row.custo_produto_unitario != null || row.aliquota != null));

    if (!parsed.length) throw new Error("Nenhuma linha válida encontrada na planilha. Use colunas item_id/mlb + custo/aliquota.");

    const unique = new Map();
    for (const row of parsed) unique.set(row.item_id, row);
    const rows = Array.from(unique.values());

    const report = { inserted: 0, items: rows.length };
    for (const row of rows) {
      await upsertConfig({ accountKey, sellerId, itemId: row.item_id, custoProdutoUnitario: row.custo_produto_unitario, aliquota: row.aliquota, userId, source: "import", meta: { filename } });
      report.inserted += 1;
    }
    return { success: true, report };
  }
}

module.exports = RentabilidadeService;
