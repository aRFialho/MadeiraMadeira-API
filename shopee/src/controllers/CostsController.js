
const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

async function listCosts(req, res) {
  const shopId = req.auth.activeShopId;
  if (!shopId) throw new Error("Shop não selecionado.");

  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 50;
  const search = String(req.query.q || "").trim();

  const where = {
    shopId,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { itemSku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: {
        id: true,
        itemId: true,
        title: true,
        itemSku: true,
        costCents: true,
        // imageUrl: true, // Product does not have imageUrl directly, use relation
        images: { take: 1, select: { url: true } },
      },
      orderBy: { title: "asc" },
    }),
  ]);

  // Busca taxa da loja
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { taxRate: true },
  });

  res.json({
    items: items.map((i) => ({
      ...i,
      itemId: String(i.itemId),
      imageUrl: i.images?.[0]?.url || null,
      cost: (i.costCents || 0) / 100,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    taxRate: shop?.taxRate || 0,
  });
}

async function updateCost(req, res) {
  const shopId = req.auth.activeShopId;
  const { id } = req.params;
  const { cost } = req.body; // float

  if (!shopId) throw new Error("Shop não selecionado.");

  const costCents = Math.round(Number(cost) * 100);

  await prisma.product.updateMany({
    where: { id: Number(id), shopId },
    data: { costCents },
  });

  res.json({ success: true });
}

async function updateTaxRate(req, res) {
  const shopId = req.auth.activeShopId;
  const { taxRate } = req.body;

  if (!shopId) throw new Error("Shop não selecionado.");

  await prisma.shop.update({
    where: { id: shopId },
    data: { taxRate: Number(taxRate) || 0 },
  });

  res.json({ success: true });
}

async function importCosts(req, res) {
  const shopId = req.auth.activeShopId;
  if (!shopId) throw new Error("Shop não selecionado.");

  const { items } = req.body; // [{ itemId, cost }, ...]
  if (!Array.isArray(items)) throw new Error("Formato inválido.");

  let updated = 0;
  // Processar em lotes seria melhor, mas para MVP vai direto
  for (const it of items) {
    const itemId = BigInt(String(it.itemId));
    const costCents = Math.round(Number(it.cost) * 100);

    // Update usando itemId (chave única com shopId)
    const r = await prisma.product.updateMany({
      where: { shopId, itemId },
      data: { costCents },
    });
    updated += r.count;
  }

  res.json({ success: true, updated });
}

async function exportCosts(req, res) {
  const shopId = req.auth.activeShopId;
  if (!shopId) throw new Error("Shop não selecionado.");

  const items = await prisma.product.findMany({
    where: { shopId },
    select: { itemId: true, title: true, costCents: true, itemSku: true },
    orderBy: { title: "asc" },
  });

  // CSV Simples
  let csv = "ID do Item,Nome,SKU,Custo (R$)\n";
  for (const it of items) {
    const cost = ((it.costCents || 0) / 100).toFixed(2).replace(".", ",");
    const title = (it.title || "").replace(/"/g, '""');
    csv += `${it.itemId},"${title}",${it.itemSku || ""},"${cost}"\n`;
  }

  res.header("Content-Type", "text/csv");
  res.attachment("custos_produtos.csv");
  res.send(csv);
}

module.exports = {
  listCosts,
  updateCost,
  updateTaxRate,
  importCosts,
  exportCosts,
};
