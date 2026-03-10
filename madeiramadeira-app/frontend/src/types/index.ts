export interface User {
  userId: string;
  username: string;
  email: string;
}

export interface Product {
  id: string;
  id_produto_seller: string;
  sku: string;
  nome: string;
  descricao: string;
  ean: string;
  marca: string;
  preco_de: number;
  preco_por: number;
  estoque: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  id_pedido: number;
  id_seller: string;
  status: string;
  valor_total: number;
  data_pedido: string;
  data_entrega?: string;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  total_vendas_dia: number;
  total_vendas_semana: number;
  total_vendas_mes: number;
  total_vendas_ano: number;
  projacao_faturamento: number;
  total_pedidos: number;
  total_produtos: number;
  pedidos_pendentes: number;
  produtos_em_fila: number;
}

export interface SalesData {
  data_dia: string;
  total_vendas: number;
  quantidade_pedidos: number;
}
