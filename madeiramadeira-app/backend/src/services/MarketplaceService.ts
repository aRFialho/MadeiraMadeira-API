import axios from "axios";
import axiosRetry from "axios-retry";
import { query } from "../database/connection";
import { Product, Order, OrderDetail } from "../types";

const MM_API_URL =
  process.env.MADEIRAMADEIRA_API_URL ||
  "https://marketplace.madeiramadeira.com.br";

const MM_TOKEN = process.env.MADEIRAMADEIRA_TOKEN;

if (!MM_TOKEN) {
  console.warn("⚠️ MADEIRAMADEIRA_TOKEN não configurado");
}

const mmApiClient = axios.create({
  baseURL: MM_API_URL,
  timeout: 20000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    TOKENMM: MM_TOKEN,
  },
});

axiosRetry(mmApiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

mmApiClient.interceptors.request.use((config) => {
  console.log("➡️ MM Request:", `${config.baseURL}${config.url}`);
  return config;
});

mmApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ MM API ERROR");
    console.error("URL:", error.config?.url);
    console.error("STATUS:", error.response?.status);
    console.error("DATA:", error.response?.data);
    throw error;
  }
);

export class MarketplaceService {

  // ===============================
  // FETCH PRODUCTS
  // ===============================

  async fetchProducts(userId: string): Promise<Product[]> {

    let limit = 100;
    let offset = 0;
    let allProducts: Product[] = [];

    while (true) {

      console.log(`📦 Fetching products limit=${limit} offset=${offset}`);

      const response = await mmApiClient.get(
        `/v1/produto/publicado/limit=${limit}&offset=${offset}`
      );

      const data = response.data?.data || [];

      if (!Array.isArray(data) || data.length === 0) break;

      const products = data.map((p: any) => ({
        id: p.id_produto?.toString(),
        id_produto_seller: p.id_produto_seller,
        sku: p.sku,
        nome: p.nome,
        descricao: p.descricao || "",
        ean: p.ean || "",
        marca: p.marca || "",
        preco_de: parseFloat(p.preco_de) || 0,
        preco_por: parseFloat(p.preco_por) || 0,
        estoque: parseInt(p.estoque) || 0,
        status: p.status || "publicado",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }));

      for (const product of products) {
        try {

          await query(
            `INSERT INTO products
            (user_id, sku, id_produto_seller, nome, descricao, ean, marca,
            preco_de, preco_por, estoque, status, synced_at)

            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)

            ON CONFLICT (sku)
            DO UPDATE SET
              nome = EXCLUDED.nome,
              preco_por = EXCLUDED.preco_por,
              estoque = EXCLUDED.estoque,
              updated_at = CURRENT_TIMESTAMP,
              synced_at = EXCLUDED.synced_at`,
            [
              userId,
              product.sku,
              product.id_produto_seller,
              product.nome,
              product.descricao,
              product.ean,
              product.marca,
              product.preco_de,
              product.preco_por,
              product.estoque,
              product.status,
              product.synced_at,
            ]
          );

        } catch (err) {
          console.warn("⚠️ DB product error:", product.sku);
        }
      }

      allProducts.push(...products);

      offset += limit;
    }

    return allProducts;
  }

  // ===============================
  // FETCH ORDERS
  // ===============================

  async fetchOrders(userId: string): Promise<Order[]> {

    let limit = 100;
    let offset = 0;
    let allOrders: Order[] = [];

    while (true) {

      console.log(`📋 Fetching orders limit=${limit} offset=${offset}`);

      const response = await mmApiClient.get(
        `/v1/pedido/limit=${limit}&offset=${offset}`
      );

      const data = response.data?.data || [];

      if (!Array.isArray(data) || data.length === 0) break;

      const orders = data.map((order: any) => ({
        id: order.id_pedido?.toString() || order.id,
        id_pedido: order.id_pedido,
        id_seller: order.id_seller,
        status: order.status,
        valor_total: parseFloat(order.valor_total) || 0,
        data_pedido: new Date(order.data_pedido).toISOString(),
        data_entrega: order.data_entrega
          ? new Date(order.data_entrega).toISOString()
          : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      for (const order of orders) {
        try {

          await query(
            `INSERT INTO orders
            (user_id,id_pedido,id_seller,status,valor_total,data_pedido,data_entrega)

            VALUES ($1,$2,$3,$4,$5,$6,$7)

            ON CONFLICT (id_pedido)
            DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP`,
            [
              userId,
              order.id_pedido,
              order.id_seller,
              order.status,
              order.valor_total,
              order.data_pedido,
              order.data_entrega,
            ]
          );

        } catch (err) {
          console.warn("⚠️ DB order error:", order.id_pedido);
        }
      }

      allOrders.push(...orders);

      offset += limit;
    }

    return allOrders;
  }

  // ===============================
  // ORDER DETAIL
  // ===============================

  async getOrderDetail(userId: string, orderId: number): Promise<OrderDetail> {

    const response = await mmApiClient.get(`/v1/pedido/${orderId}`);

    const order = response.data?.data;

    if (!order) throw new Error("Pedido não encontrado");

    const items = (order.itens || []).map((i: any) => ({
      id: i.id,
      sku: i.sku,
      nome: i.nome,
      quantidade: parseInt(i.quantidade) || 0,
      preco_unitario: parseFloat(i.preco_unitario) || 0,
      subtotal: parseFloat(i.subtotal) || 0,
    }));

    const valor_total = parseFloat(order.valor_total) || 0;
    const valor_frete = parseFloat(order.valor_frete) || 0;
    const desconto_percentual = parseFloat(order.desconto_percentual) || 0;

    const desconto_valor =
      parseFloat(order.desconto_valor) ||
      (desconto_percentual > 0
        ? (valor_total * desconto_percentual) / 100
        : 0);

    const valor_liquido = valor_total - desconto_valor;

    const taxa_plataforma_percentual = 12;
    const taxa_plataforma_valor =
      (valor_liquido * taxa_plataforma_percentual) / 100;

    const repasse_liquido =
      valor_liquido - taxa_plataforma_valor;

    return {
      id: orderId.toString(),
      id_pedido: order.id_pedido,
      id_seller: order.id_seller,
      status: order.status,
      valor_total,
      items,
      valor_frete,
      desconto_percentual,
      desconto_valor,
      valor_liquido,
      taxa_plataforma_percentual,
      taxa_plataforma_valor,
      repasse_liquido,
      data_pedido: new Date(order.data_pedido).toISOString(),
      data_entrega: order.data_entrega
        ? new Date(order.data_entrega).toISOString()
        : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ===============================
  // UPDATE PRODUCT
  // ===============================

  async updateProduct(sku: string, data: Partial<Product>) {

    await mmApiClient.put("/v1/produto", {
      sku,
      nome: data.nome,
      descricao: data.descricao,
      preco_de: data.preco_de,
      preco_por: data.preco_por,
      estoque: data.estoque,
      marca: data.marca,
      ean: data.ean,
    });

    console.log("✅ Produto atualizado:", sku);
  }

  // ===============================
  // UPDATE ORDER STATUS
  // ===============================

  async updateOrderStatus(orderId: number, status: string) {

    const statusMap: any = {
      received: "recebido",
      invoiced: "nf_emitida",
      delivered: "entregue",
    };

    const mmStatus = statusMap[status] || status;

    await mmApiClient.put(`/v1/pedido/${mmStatus}`, {
      id_pedido: orderId,
    });

    console.log("✅ Pedido atualizado:", orderId);
  }

}

export default new MarketplaceService();