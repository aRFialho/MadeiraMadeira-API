import axios from 'axios';
import { query } from '../database/connection';
import { Product, Order, OrderDetail } from '../types';

const MM_API_URL =
  process.env.MADEIRAMADEIRA_API_URL ||
  'https://marketplace.madeiramadeira.com.br';
const MM_TOKEN = process.env.MADEIRAMADEIRA_TOKEN;

if (!MM_TOKEN) {
  // Warn instead of throw to prevent app crash if env var is missing during build/startup
  console.warn("⚠️ MADEIRAMADEIRA_TOKEN não configurado nas variáveis de ambiente");
}

const mmApiClient = axios.create({
  baseURL: MM_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'TOKENMM': MM_TOKEN,
  },
  timeout: 15000,
});

mmApiClient.interceptors.request.use((config) => {
  console.log("➡️ MM Request:", `${config.baseURL}${config.url}`);
  return config;
});

mmApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ MM API RESPONSE ERROR:");
    console.error("URL:", error.config?.url);
    console.error("STATUS:", error.response?.status);
    console.error("DATA:", JSON.stringify(error.response?.data || {}, null, 2));
    throw error;
  }
);

export class MarketplaceService {
  async fetchProducts(userId: string, limit: number = 100, offset: number = 0): Promise<Product[]> {
    try {
      console.log(`📦 Fetching products (limit: ${limit}, offset: ${offset})`);
      const response = await mmApiClient.get(`/v1/produto/publicado?limit=${limit}&offset=${offset}`);

      const responseData = response.data?.data || response.data || [];

      if (Array.isArray(responseData)) {
        const products = responseData.map((product: any) => ({
          id: product.id_produto || product.id,
          id_produto_seller: product.id_produto_seller,
          sku: product.sku,
          nome: product.nome,
          descricao: product.descricao || '',
          ean: product.ean || '',
          marca: product.marca || '',
          preco_de: parseFloat(product.preco_de) || 0,
          preco_por: parseFloat(product.preco_por) || 0,
          estoque: parseInt(product.estoque) || 0,
          status: product.status || 'publicado',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        }));

        // Salvar no banco
        for (const product of products) {
          try {
            await query(
              `INSERT INTO products (user_id, id_produto_seller, sku, nome, descricao, ean, marca, preco_de, preco_por, estoque, status, synced_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               ON CONFLICT (sku) DO UPDATE SET updated_at = CURRENT_TIMESTAMP, synced_at = $12`,
              [userId, product.id_produto_seller, product.sku, product.nome, product.descricao, product.ean, product.marca, product.preco_de, product.preco_por, product.estoque, product.status, product.synced_at]
            );
          } catch (dbError) {
            console.warn(`⚠️  Could not save product ${product.sku} to database`);
          }
        }

        return products;
      }

      return [];
    } catch (error: any) {
      console.error(
        "❌ MM API ERROR:",
        error.response?.status,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async fetchOrders(userId: string, limit: number = 100, offset: number = 0): Promise<Order[]> {
    try {
      console.log(`📋 Fetching orders (limit: ${limit}, offset: ${offset})`);
      const response = await mmApiClient.get(`/v1/pedido?limit=${limit}&offset=${offset}`);

      const responseData = response.data?.data || response.data || [];

      if (Array.isArray(responseData)) {
        const orders = responseData.map((order: any) => ({
          id: order.id_pedido?.toString() || order.id,
          id_pedido: order.id_pedido,
          id_seller: order.id_seller || '',
          status: order.status || 'pending',
          valor_total: parseFloat(order.valor_total) || 0,
          data_pedido: order.data_pedido ? new Date(order.data_pedido).toISOString() : new Date().toISOString(),
          data_entrega: order.data_entrega ? new Date(order.data_entrega).toISOString() : undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        // Salvar no banco
        for (const order of orders) {
          try {
            await query(
              `INSERT INTO orders (user_id, id_pedido, id_seller, status, valor_total, data_pedido, data_entrega)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id_pedido) DO UPDATE SET status = $4, updated_at = CURRENT_TIMESTAMP, data_entrega = $7`,
              [userId, order.id_pedido, order.id_seller, order.status, order.valor_total, order.data_pedido, order.data_entrega]
            );
          } catch (dbError) {
            console.warn(`⚠️  Could not save order ${order.id_pedido} to database`);
          }
        }

        return orders;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Error fetching orders from Marketplace:', error.message);
      throw error;
    }
  }

  async getOrderDetail(userId: string, orderId: number): Promise<OrderDetail> {
    try {
      console.log(`📊 Fetching order detail: ${orderId}`);
      const response = await mmApiClient.get(`/v1/pedido/${orderId}`);

      if (response.data?.data) {
        const order = response.data.data;
        const items = (order.itens || []).map((item: any) => ({
          id: item.id || item.id_item,
          id_produto: item.id_produto,
          sku: item.sku,
          nome: item.nome,
          preco_unitario: parseFloat(item.preco_unitario) || 0,
          quantidade: parseInt(item.quantidade) || 0,
          subtotal: parseFloat(item.subtotal) || 0,
        }));

        const valor_frete = parseFloat(order.valor_frete) || 0;
        const desconto_percentual = parseFloat(order.desconto_percentual) || 0;
        const desconto_valor = 
          parseFloat(order.desconto_valor) || 
          (desconto_percentual > 0 
            ? (parseFloat(order.valor_total) * desconto_percentual) / 100 
            : 0);
        const valor_liquido = parseFloat(order.valor_total) - desconto_valor;

        // Taxa padrão de plataforma MadeiraMadeira
        const taxa_plataforma_percentual = 12; // 12% padrão
        const taxa_plataforma_valor = (valor_liquido * taxa_plataforma_percentual) / 100;
        const repasse_liquido = valor_liquido - taxa_plataforma_valor;

        return {
          id: orderId.toString(),
          id_pedido: order.id_pedido,
          id_seller: order.id_seller || '',
          status: order.status || 'pending',
          valor_total: parseFloat(order.valor_total) || 0,
          items,
          valor_frete,
          desconto_percentual,
          desconto_valor,
          valor_liquido,
          taxa_plataforma_percentual,
          taxa_plataforma_valor,
          repasse_liquido,
          data_pedido: order.data_pedido ? new Date(order.data_pedido).toISOString() : new Date().toISOString(),
          data_entrega: order.data_entrega ? new Date(order.data_entrega).toISOString() : undefined,
          data_pagamento: order.data_pagamento ? new Date(order.data_pagamento).toISOString() : undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      throw new Error(`Order ${orderId} not found`);
    } catch (error: any) {
      console.error('❌ Error fetching order detail:', error.message);
      throw error;
    }
  }

  async updateProduct(userId: string, sku: string, productData: Partial<Product>): Promise<void> {
    try {
      console.log(`✏️  Updating product: ${sku}`);
      
      await mmApiClient.put(`/v1/produto`, {
        sku,
        nome: productData.nome,
        descricao: productData.descricao,
        preco_de: productData.preco_de,
        preco_por: productData.preco_por,
        estoque: productData.estoque,
        marca: productData.marca,
        ean: productData.ean,
      });

      // Atualizar no banco
      await query(
        `UPDATE products SET nome = COALESCE($2, nome), descricao = COALESCE($3, descricao), 
                            preco_de = COALESCE($4, preco_de), preco_por = COALESCE($5, preco_por),
                            estoque = COALESCE($6, estoque), updated_at = CURRENT_TIMESTAMP 
         WHERE sku = $1 AND user_id = $7`,
        [sku, productData.nome, productData.descricao, productData.preco_de, productData.preco_por, productData.estoque, userId]
      );

      console.log(`✅ Product ${sku} updated successfully`);
    } catch (error: any) {
      console.error('❌ Error updating product:', error.message);
      throw error;
    }
  }

  async updateOrderStatus(userId: string, orderId: number, status: string): Promise<void> {
    try {
      console.log(`📌 Updating order ${orderId} status to: ${status}`);
      
      const statusMap: { [key: string]: string } = {
        received: 'recebido',
        invoiced: 'nf_emitida',
        delivered: 'entregue',
      };

      await mmApiClient.put(`/v1/pedido/${statusMap[status] || status}`, {
        id_pedido: orderId,
      });

      // Atualizar no banco
      await query(
        `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id_pedido = $2 AND user_id = $3`,
        [status, orderId, userId]
      );

      console.log(`✅ Order ${orderId} status updated successfully`);
    } catch (error: any) {
      console.error('❌ Error updating order status:', error.message);
      throw error;
    }
  }
}

export default new MarketplaceService();
