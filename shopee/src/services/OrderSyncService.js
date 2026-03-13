const crypto = require("crypto");
const prisma = require("../config/db");
const { requestShopeeAuthed } = require("./ShopeeAuthedHttp");

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function parseRangeDays(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 7;
  const x = Math.floor(n);
  return Math.min(Math.max(x, 1), 180);
}

function addressKeyFromShopee(addr) {
  return [
    normalizeZipcode(addr?.zipcode),
    normalizeStr(addr?.state),
    normalizeStr(addr?.city),
    normalizeStr(addr?.full_address),
  ].join("|");
}

function addressKeyFromSnapshot(snap) {
  return [
    normalizeZipcode(snap?.zipcode),
    normalizeStr(snap?.state),
    normalizeStr(snap?.city),
    normalizeStr(snap?.fullAddress),
  ].join("|");
}

function normalizeStr(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, " ") // remove pontuação/símbolos
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeZipcode(v) {
  const digits = String(v || "").replace(/\D+/g, "");
  return digits;
}

function looksMasked(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return s.includes("*") || low.includes("xxx") || low.includes("masked");
}

async function persistOrderGeoAddressOnce({ shopInternalId, order, addr }) {
  const stateRaw = String(addr?.state || "").trim();
  const cityRaw = String(addr?.city || "").trim();

  if (!stateRaw || looksMasked(stateRaw)) return; // UF é o mínimo mesmo

  const payload = {
    shopId: shopInternalId,
    orderId: order.id,
    orderSn: order.orderSn,

    state: stateRaw,
    stateNorm: normalizeStr(stateRaw),

    // cidade opcional (para permitir “UF-only”)
    city: cityRaw && !looksMasked(cityRaw) ? cityRaw : null,
    cityNorm: cityRaw && !looksMasked(cityRaw) ? normalizeStr(cityRaw) : null,

    zipcode: addr?.zipcode ? String(addr.zipcode) : null,

    // se mascarado, não salva endereço completo
    fullAddress:
      addr?.full_address && !looksMasked(addr.full_address)
        ? String(addr.full_address)
        : null,

    // datas: evite null pra ajudar filtros do mapa
    shopeeCreateTime:
      order.shopeeCreateTime || order.shopeeUpdateTime || new Date(),
    shopeeUpdateTime: order.shopeeUpdateTime || null,
  };

  // Se já existe: não “regride”, só melhora dados (ex.: antes sem city, agora com city)
  const existing = await prisma.orderGeoAddress.findUnique({
    where: { orderId: order.id },
    select: { id: true, city: true, fullAddress: true },
  });

  if (!existing) {
    try {
      await prisma.orderGeoAddress.create({ data: payload });
      return; // ✅ essencial
    } catch (e) {
      if (e?.code === "P2002") return;
      console.error("persistOrderGeoAddressOnce failed:", e);
      return;
    }
  }
  const shouldUpdate =
    (!existing.city && payload.city) ||
    (!existing.fullAddress && payload.fullAddress);

  if (shouldUpdate) {
    await prisma.orderGeoAddress.update({
      where: { orderId: order.id },
      data: {
        city: payload.city ?? undefined,
        cityNorm: payload.cityNorm ?? undefined,
        fullAddress: payload.fullAddress ?? undefined,
        zipcode: payload.zipcode ?? undefined,
        shopeeCreateTime: payload.shopeeCreateTime,
        shopeeUpdateTime: payload.shopeeUpdateTime,
        state: payload.state,
        stateNorm: payload.stateNorm,
      },
    });
  }
}

function addressHash(addr) {
  const key = addressKeyFromShopee(addr);
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

function calcLateAndRisk(orderStatus, shipByDate) {
  if (!shipByDate) return { late: false, atRisk: false };

  const now = Date.now();
  const msLeft = shipByDate.getTime() - now;
  const active = orderStatus === "READY_TO_SHIP";

  return {
    late: active && msLeft < 0,
    atRisk: active && msLeft >= 0 && msLeft <= 24 * 60 * 60 * 1000,
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isOrderClosed(orderStatus) {
  const s = String(orderStatus || "").toUpperCase();
  return ["COMPLETED", "CANCELLED", "RETURNED"].includes(s);
}

function extractGmvCents(detail) {
  let v = detail?.total_amount;
  if (v == null) return null;

  if (typeof v === "string") v = Number(v.replace(",", "."));
  if (!Number.isFinite(v)) return null;

  return Math.round(v * 100);
}

function extractItemsSubtotalCents(detail) {
  const items = Array.isArray(detail?.item_list) ? detail.item_list : [];
  if (!items.length) return null;

  let sum = 0;

  for (const it of items) {
    const qty = Math.max(
      0,
      Number(it?.model_quantity_purchased ?? it?.quantity ?? 0) || 0,
    );

    // preferir preço "discounted" do modelo (mais próximo do subtotal de produtos)
    const unit =
      num(it?.model_discounted_price) ||
      num(it?.item_price) ||
      num(it?.original_price) ||
      num(it?.model_original_price) ||
      0;

    if (qty <= 0 || unit <= 0) continue;

    sum += Math.round(unit * 100) * qty; // unit em R$, vira centavos
  }

  // se não conseguiu calcular nada (itens sem preço), retorna null
  return sum > 0 ? sum : null;
}

function parseMoneyToCents(v) {
  if (v == null) return 0;

  // Shopee costuma mandar número como string ("12.34") ou number
  if (typeof v === "string") v = Number(v.replace(",", "."));
  if (!Number.isFinite(v)) return 0;

  return Math.round(v * 100);
}

function num(v) {
  if (v == null) return 0;
  if (typeof v === "string") v = Number(v.replace(",", "."));
  return Number.isFinite(v) ? Number(v) : 0;
}

async function persistOrderItems({ shopInternalId, order, detail }) {
  const items = Array.isArray(detail?.item_list) ? detail.item_list : [];

  await prisma.orderItem.deleteMany({
    where: { shopId: shopInternalId, orderId: order.id },
  });

  if (!items.length) return;

  // Buscar produtos locais para vincular (para pegar custo depois)
  const itemIds = items
    .map((it) => (it.item_id ? BigInt(it.item_id) : null))
    .filter(Boolean);

  const localProducts = await prisma.product.findMany({
    where: {
      shopId: shopInternalId,
      itemId: { in: itemIds },
    },
    select: { id: true, itemId: true },
  });

  const productMap = new Map();
  for (const p of localProducts) {
    productMap.set(String(p.itemId), p.id);
  }

  // peso = preço_base * quantidade (escala não importa)
  const weights = items.map((it) => {
    const quantity = Math.max(
      0,
      Number(it?.model_quantity_purchased ?? it?.quantity ?? 0) || 0,
    );

    const priceBase =
      num(it?.model_discounted_price) ||
      num(it?.item_price) ||
      num(it?.original_price) ||
      num(it?.model_original_price) ||
      0;

    const weight = priceBase * quantity;
    return { it, quantity, priceBase, weight };
  });

  const totalWeight = weights.reduce((s, x) => s + x.weight, 0);

  // rateio com ajuste de arredondamento pra fechar exatamente no total do pedido
  const orderBaseCents = Number(
    order.itemsSubtotalCents ?? order.gmvCents ?? 0,
  );
  let remaining = orderBaseCents;

  const rows = weights.map((x, idx) => {
    const it = x.it;

    const itemId = it?.item_id != null ? BigInt(String(it.item_id)) : null;
    const modelId = it?.model_id != null ? BigInt(String(it.model_id)) : null;

    const productId = productMap.get(String(itemId)) || null;

    const name = it?.item_name || it?.name || null;
    const sku = it?.item_sku || it?.model_sku || it?.sku || null;

    // preçoCents: opcional (só para exibição). Como não temos certeza da escala,
    // deixo como 0 por enquanto (ou você pode armazenar a "base" em outro campo).
    const priceCents = 0;

    let gmvCents = 0;
    if (totalWeight > 0) {
      if (idx === weights.length - 1) {
        // último recebe o resto pra fechar
        gmvCents = remaining;
      } else {
        gmvCents = Math.round((orderBaseCents * x.weight) / totalWeight);
        remaining -= gmvCents;
      }
    }

    return {
      shopId: shopInternalId,
      orderId: order.id,
      productId, // VINCULADO AGORA
      itemId,
      modelId,
      itemSku: sku,
      itemName: name,
      quantity: x.quantity,
      orderPrice: priceCents,
      // gmvCents não existe em OrderItem, remover ou usar outro campo
      // variationPrice? dealPrice?
    };
  });

  await prisma.orderItem.createMany({ data: rows });
}

async function upsertOrderAndSnapshot(shopInternalId, detail) {
  const orderSn = String(detail.order_sn);
  const gmvCandidate = extractGmvCents(detail);
  const itemsSubtotalCents = extractItemsSubtotalCents(detail);
  const shippingCents =
    itemsSubtotalCents != null && gmvCandidate != null
      ? Math.max(0, gmvCandidate - itemsSubtotalCents)
      : null;
  const shipByDate = detail.ship_by_date
    ? new Date(Number(detail.ship_by_date) * 1000)
    : null;

  const estimatedShippingFeeCents =
    detail.estimated_shipping_fee != null
      ? parseMoneyToCents(detail.estimated_shipping_fee)
      : 0;

  const actualShippingFeeCents =
    detail.actual_shipping_fee != null
      ? parseMoneyToCents(detail.actual_shipping_fee)
      : 0;

  const order = await prisma.order.upsert({
    where: { shopId_orderSn: { shopId: shopInternalId, orderSn } },
    create: {
      gmvCents: gmvCandidate ?? 0,
      shopId: shopInternalId,
      orderSn,
      orderStatus: detail.order_status || null,
      region: detail.region || null,
      currency: detail.currency || null,
      daysToShip: detail.days_to_ship ?? null,
      shipByDate,
      shopeeCreateTime: detail.create_time
        ? new Date(Number(detail.create_time) * 1000)
        : null,
      shopeeUpdateTime: detail.update_time
        ? new Date(Number(detail.update_time) * 1000)
        : null,
      bookingSn: detail.booking_sn || null,
      cod: detail.cod ?? null,
      advancePackage: detail.advance_package ?? null,
      hotListingOrder: detail.hot_listing_order ?? null,
      isBuyerShopCollection: detail.is_buyer_shop_collection ?? null,
      messageToSeller: detail.message_to_seller || null,
      reverseShippingFee:
        detail.reverse_shipping_fee != null
          ? parseMoneyToCents(detail.reverse_shipping_fee)
          : null,
      itemsSubtotalCents,
      shippingCents, // Este shippingCents antigo era calculado (gmv - items). Agora temos estimated e actual.
      // Novos campos
      estimatedShippingFeeCents,
      actualShippingFeeCents,
      shippingCarrier: detail.shipping_carrier || null,
      paymentMethod: detail.payment_method || null,
    },
    update: {
      ...(gmvCandidate != null ? { gmvCents: gmvCandidate } : {}),
      ...(itemsSubtotalCents != null ? { itemsSubtotalCents } : {}),
      ...(shippingCents != null ? { shippingCents } : {}),
      orderStatus: detail.order_status || null,
      region: detail.region || null,
      currency: detail.currency || null,
      daysToShip: detail.days_to_ship ?? null,
      shipByDate,
      shopeeCreateTime: detail.create_time
        ? new Date(Number(detail.create_time) * 1000)
        : null,
      shopeeUpdateTime: detail.update_time
        ? new Date(Number(detail.update_time) * 1000)
        : null,
      bookingSn: detail.booking_sn || null,
      cod: detail.cod ?? null,
      advancePackage: detail.advance_package ?? null,
      hotListingOrder: detail.hot_listing_order ?? null,
      isBuyerShopCollection: detail.is_buyer_shop_collection ?? null,
      messageToSeller: detail.message_to_seller || null,
      reverseShippingFee:
        detail.reverse_shipping_fee != null
          ? parseMoneyToCents(detail.reverse_shipping_fee)
          : null,
      // Novos campos update
      estimatedShippingFeeCents,
      actualShippingFeeCents,
      shippingCarrier: detail.shipping_carrier || null,
      paymentMethod: detail.payment_method || null,
    },
  });
  // ✅ salva itens do pedido para ranking por GMV do mês
  await persistOrderItems({ shopInternalId, order, detail });
  const addr = detail.recipient_address || null;
  if (addr) {
    await persistOrderGeoAddressOnce({ shopInternalId, order, addr });
  }
  let addressChanged = false; // "mudou de verdade" (comparado com snapshot anterior)
  let snapshotCreated = false;

  // Se o pedido fechou, resolve alertas abertos e não cria novos
  if (isOrderClosed(order.orderStatus)) {
    await prisma.orderAddressChangeAlert.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "RESOLVED" },
    });
    // Ainda podemos criar snapshot? (opcional). Por segurança, aqui eu não crio.
  } else if (addr) {
    const currentKey = addressKeyFromShopee(addr);
    const currentHash = addressHash(addr);

    const last = await prisma.orderAddressSnapshot.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        addressHash: true,
        zipcode: true,
        state: true,
        city: true,
        fullAddress: true,
      },
    });

    const lastKey = last ? addressKeyFromSnapshot(last) : null;

    // ✅ changedNow depende SOMENTE do endereço do cliente (não do hash)
    const changedNow = !last ? true : currentKey !== lastKey;

    // se o endereço é igual mas o hash antigo difere (mudança de algoritmo/normalização),
    // só corrige o hash do último snapshot (não cria snapshot/alerta)
    if (last && !changedNow && last.addressHash !== currentHash) {
      await prisma.orderAddressSnapshot.update({
        where: { id: last.id },
        data: { addressHash: currentHash },
      });
    }

    if (changedNow) {
      const newSnap = await prisma.orderAddressSnapshot.create({
        data: {
          orderId: order.id,
          name: addr.name || null,
          phone: addr.phone || null,
          town: addr.town || null,
          district: addr.district || null,
          city: addr.city || null,
          state: addr.state || null,
          region: addr.region || null,
          zipcode: addr.zipcode || null,
          fullAddress: addr.full_address || null,
          addressHash: currentHash,
        },
        select: { id: true },
      });

      snapshotCreated = true;

      if (last) {
        addressChanged = true;

        await prisma.orderAddressChangeAlert.upsert({
          where: {
            orderId_newHash: { orderId: order.id, newHash: currentHash },
          },
          update: {
            status: "PENDING",
            oldSnapshotId: last.id,
            newSnapshotId: newSnap.id,
            oldHash: last.addressHash,
          },
          create: {
            orderId: order.id,
            oldSnapshotId: last.id,
            newSnapshotId: newSnap.id,
            oldHash: last.addressHash,
            newHash: currentHash,
          },
        });
      }
    }
  }

  const { late, atRisk } = calcLateAndRisk(order.orderStatus, order.shipByDate);

  return { addressChanged, late, atRisk, orderSn: order.orderSn };
}

// Helper para somar itens do breakdown
function sumBreakdown(items, nameKey) {
  if (!Array.isArray(items)) return 0;
  // nameKey pode ser string única ou array de strings
  const keys = Array.isArray(nameKey) ? nameKey : [nameKey];
  let total = 0;
  for (const it of items) {
    if (keys.includes(it.name)) {
      total += it.amount || 0;
    }
  }
  return Math.round(total * 100); // retorna em cents
}

function parseIncomeBreakdown(info) {
  // Se não tiver breakdown, tenta usar campos flat (legado/outra versão)
  if (!info.seller_income_breakdown && !info.buyer_total_amount) {
    return {};
  }

  // Flatten breakdown items
  // Estrutura esperada: info.seller_income_breakdown = [ { items: [ {name, amount}, ... ] }, ... ]
  let allItems = [];
  if (Array.isArray(info.seller_income_breakdown)) {
    for (const group of info.seller_income_breakdown) {
      if (Array.isArray(group.items)) {
        allItems.push(...group.items);
      }
    }
  }

  // Se breakdown vazio, tenta pegar de campos flat (fallback)
  if (!allItems.length) {
    return {
      finCommissionCents: parseMoneyToCents(info.commission_fee),
      finServiceFeeCents: parseMoneyToCents(info.service_fee),
      finTransactionFeeCents: parseMoneyToCents(info.transaction_fee),
      finShippingFeeCents: parseMoneyToCents(info.final_shipping_fee), // Frete real descontado
      finVoucherSellerCents: parseMoneyToCents(info.voucher_from_seller),
      finVoucherShopeeCents: parseMoneyToCents(info.voucher_from_shopee),
      finShopeeDiscountCents: parseMoneyToCents(info.shopee_discount),
      finDiscountFromCoinCents: parseMoneyToCents(info.discount_from_coin),
      finDiscountVoucherShopeeCents: parseMoneyToCents(
        info.discount_from_voucher_shopee,
      ),
      finDiscountVoucherSellerCents: parseMoneyToCents(
        info.discount_from_voucher_seller,
      ),
    };
  }

  // Mapeamento baseado em nomes comuns da API v2
  // https://open.shopee.com/documents?module=87&type=2&id=59&version=2
  // Names: COMMISSION_FEE, SERVICE_FEE, TRANSACTION_FEE, SHIPPING_FEE, VOUCHER_FROM_SELLER, VOUCHER_FROM_SHOPEE...

  return {
    finCommissionCents: sumBreakdown(allItems, "COMMISSION_FEE"),
    finServiceFeeCents: sumBreakdown(allItems, "SERVICE_FEE"),
    finTransactionFeeCents: sumBreakdown(allItems, "TRANSACTION_FEE"),
    finShippingFeeCents: sumBreakdown(allItems, [
      "SHIPPING_FEE",
      "SHIPPING_FEE_DISCOUNT_FROM_3PL",
    ]), // Às vezes shipping fee vem positivo e desconto negativo? Verificar sinal. Geralmente aqui é o custo final.
    finVoucherSellerCents: sumBreakdown(allItems, "VOUCHER_FROM_SELLER"),
    finVoucherShopeeCents: sumBreakdown(allItems, "VOUCHER_FROM_SHOPEE"),
    finShopeeDiscountCents: sumBreakdown(allItems, "SHOPEE_DISCOUNT"),
    finDiscountFromCoinCents: sumBreakdown(allItems, "COIN"),
    finDiscountVoucherShopeeCents: sumBreakdown(
      allItems,
      "VOUCHER_FROM_SHOPEE",
    ), // duplicado? as vezes tem nomes diferentes
    finDiscountVoucherSellerCents: sumBreakdown(
      allItems,
      "VOUCHER_FROM_SELLER",
    ),
  };
}

async function syncOrderIncome(shopInternalId, shopeeShopId, orderSn) {
  try {
    const escrow = await requestShopeeAuthed({
      method: "get",
      path: "/api/v2/payment/get_escrow_detail",
      shopId: String(shopeeShopId),
      query: { order_sn: orderSn },
    });

    if (escrow?.error) {
      return;
    }

    const info = escrow?.response?.order_income;
    if (!info) return;

    const incomeNetCents = parseMoneyToCents(info.escrow_amount);

    // Parse usando breakdown ou flat
    const fin = parseIncomeBreakdown(info);

    await prisma.order.update({
      where: { shopId_orderSn: { shopId: shopInternalId, orderSn } },
      data: {
        incomeSyncedAt: new Date(),
        incomeStatus: info.status || "UNKNOWN",
        incomeNetCents,
        ...fin,
      },
    });
  } catch (e) {
    console.error(`[Income] Error syncing ${orderSn}:`, e.message);
  }
}

async function syncOrderIncomeBatch(shopInternalId, shopeeShopId, orderSns) {
  if (!orderSns.length) return;
  try {
    const batchRes = await requestShopeeAuthed({
      method: "get",
      path: "/api/v2/payment/get_escrow_detail_batch",
      shopId: String(shopeeShopId),
      query: { order_sn_list: orderSns.join(",") },
    });

    const list = batchRes?.response?.order_income_list || [];

    if (!list.length && !batchRes?.error) {
      return;
    }

    for (const info of list) {
      const orderSn = info.order_sn;
      if (!orderSn) continue;

      const incomeNetCents = parseMoneyToCents(info.escrow_amount);
      const fin = parseIncomeBreakdown(info);

      await prisma.order.update({
        where: { shopId_orderSn: { shopId: shopInternalId, orderSn } },
        data: {
          incomeSyncedAt: new Date(),
          incomeStatus: info.status || "UNKNOWN",
          incomeNetCents,
          ...fin,
        },
      });
    }
  } catch (e) {
    console.error(`[IncomeBatch] Error:`, e.message);
  }
}

async function syncOrdersForShop({ shopeeShopId, rangeDays, pageSize = 50 }) {
  // precisa do Shop interno para gravar Order.shopId (FK int)
  const shopRow = await prisma.shop.findUnique({
    where: { shopId: BigInt(String(shopeeShopId)) },
  });

  if (!shopRow) {
    const err = new Error("Shop não cadastrado no banco");
    err.statusCode = 400;
    throw err;
  }

  const timeTo = nowTs();
  const timeFrom = timeTo - rangeDays * 24 * 60 * 60;

  const WINDOW_DAYS = 14;
  const windowSec = WINDOW_DAYS * 24 * 60 * 60;

  let processed = 0;
  let addressChangedCount = 0;
  let lateCount = 0;
  let atRiskCount = 0;

  for (let windowTo = timeTo; windowTo > timeFrom; windowTo -= windowSec) {
    const windowFrom = Math.max(timeFrom, windowTo - windowSec);
    console.log("[sync] window", { windowFrom, windowTo });
    let cursor = "";
    let more = true;

    while (more) {
      const list = await requestShopeeAuthed({
        method: "get",
        path: "/api/v2/order/get_order_list",
        shopId: String(shopeeShopId),
        query: {
          time_range_field: "create_time",
          time_from: windowFrom,
          time_to: windowTo,
          page_size: pageSize,
          cursor,
        },
      });

      // Shopee pode responder erro no body com HTTP 200
      if (list?.error) {
        throw new Error(
          `Shopee get_order_list failed: ${list.error} ${list.message || ""}`,
        );
      }

      const listOrders = list?.response?.order_list || [];
      console.log(
        "[sync] listOrders:",
        listOrders.length,
        "more:",
        Boolean(list?.response?.more),
        "cursor:",
        cursor,
      );
      const orderSns = listOrders.map((o) => o.order_sn).filter(Boolean);

      const batches = chunk(orderSns, 20);
      for (const batch of batches) {
        if (batch.length === 0) continue;

        const details = await requestShopeeAuthed({
          method: "get",
          path: "/api/v2/order/get_order_detail",
          shopId: String(shopeeShopId),
          query: {
            order_sn_list: batch.join(","),
            response_optional_fields:
              "recipient_address,order_status,create_time,update_time,days_to_ship,ship_by_date,currency,total_amount,region,booking_sn,cod,advance_package,hot_listing_order,is_buyer_shop_collection,message_to_seller,reverse_shipping_fee,item_list,estimated_shipping_fee,actual_shipping_fee,shipping_carrier,payment_method",
          },
        });

        if (details?.error) {
          throw new Error(
            `Shopee get_order_detail failed: ${details.error} ${details.message || ""}`,
          );
        }

        const orderList = details?.response?.order_list || [];
        const incomeSyncCandidates = [];

        for (const d of orderList) {
          processed += 1;
          const { addressChanged, late, atRisk, orderSn } =
            await upsertOrderAndSnapshot(shopRow.id, d);
          if (addressChanged) addressChangedCount += 1;
          if (late) lateCount += 1;
          if (atRisk) atRiskCount += 1;

          if (isOrderClosed(d.order_status) || d.order_status === "SHIPPED") {
            incomeSyncCandidates.push(orderSn);
          }
        }

        if (incomeSyncCandidates.length > 0) {
          await syncOrderIncomeBatch(
            shopRow.id,
            String(shopeeShopId),
            incomeSyncCandidates,
          );
        }
      }

      more = Boolean(list?.response?.more);
      cursor = String(list?.response?.next_cursor || "");
    }
  }

  return {
    status: "ok",
    shop_id: String(shopeeShopId),
    rangeDays,
    summary: {
      processed,
      addressChanged: addressChangedCount,
      late: lateCount,
      atRisk: atRiskCount,
    },
    warning:
      processed === 0
        ? "Nenhum pedido retornado pela Shopee no período. Verifique shop_id, permissões do token e filtros do get_order_list."
        : null,
  };
}

module.exports = { parseRangeDays, syncOrdersForShop, isOrderClosed };
