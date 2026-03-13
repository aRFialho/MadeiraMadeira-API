
const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

async function getMarginData(req, res) {
  const shopId = req.auth.activeShopId;
  if (!shopId) throw new Error("Shop não selecionado.");

  const { dateFrom, dateTo } = req.query;
  if (!dateFrom || !dateTo) throw new Error("Período inválido.");

  const start = new Date(dateFrom + "T00:00:00.000Z");
  const end = new Date(dateTo + "T23:59:59.999Z");

  // Buscar pedidos no período (baseado em created_at ou shopee_create_time? Geralmente shopeeCreateTime)
  // Usaremos shopeeCreateTime pois é a data da venda na plataforma
  const orders = await prisma.order.findMany({
    where: {
      shopId,
      shopeeCreateTime: { gte: start, lte: end },
      orderStatus: { notIn: ["CANCELLED"] }, // Ignorar cancelados para faturamento? Ou considerar devoluções separadamente?
      // O usuário pediu "Total Faturado" e "Devoluções". Geralmente Faturado inclui tudo, e Devoluções subtrai.
      // Vamos pegar todos exceto CANCELLED (que nunca foi faturado de fato se cancelado antes).
      // Se foi devolvido (RETURNED), conta como venda mas tem custo de devolução.
    },
    include: {
      items: {
        include: {
          product: { select: { costCents: true } },
        },
      },
    },
  });

  // Buscar Ads Spend no período
  // Agrupar AdsHourlyMetric por shopId no período
  const adsMetrics = await prisma.adsHourlyMetric.aggregate({
    where: {
      shopId,
      date: { gte: start, lte: end },
    },
    _sum: {
      expense: true,
    },
  });

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { taxRate: true },
  });

  // Map para fallback de custo (se OrderItem não tiver productId vinculado)
  const itemIdsToFetch = new Set();
  orders.forEach((o) => {
    o.items.forEach((it) => {
      if (!it.product && it.itemId) {
        itemIdsToFetch.add(it.itemId);
      }
    });
  });

  const productCostMap = new Map(); // itemId (string) -> costCents
  if (itemIdsToFetch.size > 0) {
    const products = await prisma.product.findMany({
      where: {
        shopId,
        itemId: { in: Array.from(itemIdsToFetch) },
      },
      select: { itemId: true, costCents: true },
    });
    for (const p of products) {
      productCostMap.set(String(p.itemId), p.costCents || 0);
    }
  }

  let totalRevenueCents = 0;
  let totalProductCostCents = 0;
  let totalCommissionCents = 0;
  let totalReturnsCents = 0;
  let totalShippingCostCents = 0;
  let totalVoucherCostCents = 0;
  let totalItemsRevenueCents = 0; // Base de cálculo para impostos
  
  // SPX (Shopee Xpress) - apenas visual
  let spxShippingTotalCents = 0;
  let spxOrdersCount = 0;

  for (const o of orders) {
    // Faturamento: Itens + Frete pago pelo cliente
    // O usuário pediu: "o frete entra como faturamento"
    // itemsSubtotalCents: soma dos produtos
    // estimatedShippingFeeCents: frete pago pelo cliente (estimado na hora da compra)
    const itemsRevenue = o.itemsSubtotalCents || o.gmvCents || 0;
    const shippingRevenue = o.estimatedShippingFeeCents || 0;
    
    // Receita Total (Bruta)
    const revenue = itemsRevenue + shippingRevenue;
    
    totalRevenueCents += revenue;
    totalItemsRevenueCents += itemsRevenue;

    // Comissões
    // Preferencia para dados financeiros (Escrow/Income) se existirem
    const hasFinData = (o.finCommissionCents !== null || o.finServiceFeeCents !== null);
    
    if (hasFinData) {
        totalCommissionCents += (o.finCommissionCents || 0) + (o.finServiceFeeCents || 0) + (o.finTransactionFeeCents || 0);
    } else {
        totalCommissionCents += (o.commFeeCents || 0) + (o.serviceFeeCents || 0) + (o.transactionFeeCents || 0);
    }

    // Custo produtos
    for (const item of o.items) {
      const qty = item.quantity || 0;
      let cost = item.product?.costCents;
      
      // Fallback se não tiver vinculado
      if (cost === undefined && item.itemId) {
        cost = productCostMap.get(String(item.itemId)) || 0;
      }
      
      totalProductCostCents += (cost || 0) * qty;
    }

    // Custo Logístico
    // "salvo se o frete for Shopee Xpress (SPX) que o custo de logistica é pago diretamente pelo cliente então não há custo"
    // Identificar SPX pelo shippingCarrier
    const carrier = (o.shippingCarrier || "").toUpperCase();
    const isSpx = carrier.includes("SHOPEE") || carrier.includes("SPX") || carrier.includes("XPRESS");
    
    if (isSpx) {
        // Se for SPX, calculamos apenas para exibição (card informativo)
        // Valor do frete "pago" (que seria o custo se não fosse SPX)
        spxShippingTotalCents += (o.actualShippingFeeCents || o.estimatedShippingFeeCents || 0);
        spxOrdersCount++;
    } else {
      // Se não for SPX, assume que o vendedor paga o frete (repassa para transportadora)
      // Se tiver dado financeiro real, usa ele
      if (o.finShippingFeeCents != null) {
          totalShippingCostCents += o.finShippingFeeCents;
      } else {
          totalShippingCostCents += (o.actualShippingFeeCents || o.estimatedShippingFeeCents || 0);
      }
    }

    // Custo de Cupom Vendedor
    if (o.finVoucherSellerCents != null) {
        totalVoucherCostCents += o.finVoucherSellerCents;
    } else {
        totalVoucherCostCents += (o.voucherFromSellerCents || 0);
    }

    // Devoluções
    if (o.orderStatus === "RETURNED" || o.orderStatus === "TO_RETURN") {
        totalReturnsCents += revenue; // Estorno do valor total
        totalReturnsCents += (o.reverseShippingFee || 0);
    }
  }

  const taxRate = shop?.taxRate || 0;
  // Impostos: "descontada a porcentagem do pedido apenas no valor do produto e não a venda total"
  const totalTaxCents = Math.round(totalItemsRevenueCents * (taxRate / 100));

  const totalAdsSpendCents = adsMetrics._sum.expense || 0;

  // Total Custos
  const totalCostsCents = 
    totalCommissionCents + 
    totalProductCostCents + 
    totalReturnsCents + 
    totalTaxCents + 
    totalAdsSpendCents + 
    totalShippingCostCents + 
    totalVoucherCostCents;

  const profitCents = totalRevenueCents - totalCostsCents;
  const profitMargin = totalRevenueCents > 0 ? (profitCents / totalRevenueCents) * 100 : 0;

  res.json({
    revenue: totalRevenueCents / 100,
    costs: {
      total: totalCostsCents / 100,
      commissions: totalCommissionCents / 100,
      products: totalProductCostCents / 100,
      returns: totalReturnsCents / 100,
      taxes: totalTaxCents / 100,
      ads: totalAdsSpendCents / 100,
      shipping: totalShippingCostCents / 100,
      vouchers: totalVoucherCostCents / 100,
    },
    spx: {
        totalCents: spxShippingTotalCents / 100,
        count: spxOrdersCount
    },
    profit: profitCents / 100,
    profitMargin,
    taxRate,
  });
}

module.exports = {
  getMarginData,
};
