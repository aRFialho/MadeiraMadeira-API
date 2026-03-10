export interface OrderItem {
  id: string;
  id_produto: string;
  sku: string;
  nome: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
}

export interface OrderDetail {
  id: string;
  id_pedido: number;
  id_seller: string;
  status: string;
  valor_total: number;
  items: OrderItem[];
  
  // Cálculos e repasse
  valor_frete: number;
  desconto_percentual: number;
  desconto_valor: number;
  valor_liquido: number;
  
  // Comissões
  taxa_plataforma_percentual: number;
  taxa_plataforma_valor: number;
  
  repasse_liquido: number;
  
  data_pedido: string;
  data_entrega?: string;
  data_pagamento?: string;
  
  created_at: string;
  updated_at: string;
}
