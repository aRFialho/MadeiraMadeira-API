import { query } from '../database/connection';
import { Dashboard } from '../types';

export class DashboardService {
  async getDashboardMetrics(userId: string): Promise<Dashboard> {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

      const result = await query(
        `SELECT
          COALESCE(SUM(CASE WHEN DATE(data_pedido) = CURRENT_DATE THEN valor_total ELSE 0 END), 0) as total_vendas_dia,
          COALESCE(SUM(CASE WHEN data_pedido >= $2 THEN valor_total ELSE 0 END), 0) as total_vendas_semana,
          COALESCE(SUM(CASE WHEN data_pedido >= $3 THEN valor_total ELSE 0 END), 0) as total_vendas_mes,
          COALESCE(SUM(CASE WHEN data_pedido >= $4 THEN valor_total ELSE 0 END), 0) as total_vendas_ano,
          COUNT(*) as total_pedidos,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pedidos_pendentes
         FROM orders WHERE user_id = $1`,
        [userId, sevenDaysAgo, thirtyDaysAgo, oneYearAgo]
      );

      const orderMetrics = result.rows[0] || {};

      const resultProducts = await query(
        `SELECT COUNT(*) as total_produtos, COALESCE(SUM(CASE WHEN status = 'aguardando' THEN 1 ELSE 0 END), 0) as produtos_em_fila FROM products WHERE user_id = $1`,
        [userId]
      );

      const productMetrics = resultProducts.rows[0] || {};

      const total_vendas_mes = parseFloat(orderMetrics.total_vendas_mes) || 0;
      const projacao_faturamento = total_vendas_mes > 0 ? (total_vendas_mes / 30) * 365 : 0;

      return {
        total_vendas_dia: parseFloat(orderMetrics.total_vendas_dia) || 0,
        total_vendas_semana: parseFloat(orderMetrics.total_vendas_semana) || 0,
        total_vendas_mes,
        total_vendas_ano: parseFloat(orderMetrics.total_vendas_ano) || 0,
        projacao_faturamento,
        total_pedidos: parseInt(orderMetrics.total_pedidos) || 0,
        total_produtos: parseInt(productMetrics.total_produtos) || 0,
        pedidos_pendentes: parseInt(orderMetrics.pedidos_pendentes) || 0,
        produtos_em_fila: parseInt(productMetrics.produtos_em_fila) || 0,
      };
    } catch (error: any) {
      console.error('❌ Error getting dashboard metrics:', error.message);
      throw error;
    }
  }

  async getSalesChart(userId: string, days: number = 30): Promise<any[]> {
    try {
      const result = await query(
        `SELECT data_dia, total_vendas, quantidade_pedidos FROM sales_metrics
         WHERE user_id = $1 AND data_dia >= CURRENT_DATE - INTERVAL '${days} days'
         ORDER BY data_dia ASC`,
        [userId]
      );

      return result.rows || [];
    } catch (error: any) {
      console.error('❌ Error getting sales chart:', error.message);
      throw error;
    }
  }

  async recordDailySales(userId: string): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await query(
        `SELECT COALESCE(SUM(valor_total), 0) as total_vendas, COUNT(*) as quantidade_pedidos
         FROM orders WHERE user_id = $1 AND DATE(data_pedido) = $2`,
        [userId, today]
      );

      if (result.rows && result.rows[0]) {
        const { total_vendas, quantidade_pedidos } = result.rows[0];

        await query(
          `INSERT INTO sales_metrics (user_id, data_dia, total_vendas, quantidade_pedidos)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, data_dia) DO UPDATE SET total_vendas = $3, quantidade_pedidos = $4`,
          [userId, today, total_vendas, quantidade_pedidos]
        );
      }
    } catch (error: any) {
      console.error('❌ Error recording daily sales:', error.message);
      throw error;
    }
  }
}

export default new DashboardService();
