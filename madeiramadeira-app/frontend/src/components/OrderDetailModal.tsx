import React, { useEffect, useState } from 'react';
import { marketplaceApi } from '../api/endpoints';

interface OrderDetailModalProps {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface OrderDetail {
  id: string;
  id_pedido: number;
  status: string;
  valor_total: number;
  items: any[];
  valor_frete: number;
  desconto_percentual: number;
  desconto_valor: number;
  valor_liquido: number;
  taxa_plataforma_percentual: number;
  taxa_plataforma_valor: number;
  repasse_liquido: number;
  data_pedido: string;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ orderId, isOpen, onClose }) => {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetail();
    }
  }, [isOpen, orderId]);

  const loadOrderDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await marketplaceApi.getOrderDetail(orderId);
      setOrder(response.data as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Detalhe do Pedido #{orderId}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Informações Gerais */}
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-semibold mb-3 text-lg">Informações Gerais</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Data do Pedido</p>
                  <p className="font-semibold">
                    {new Date(order.data_pedido).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
                    {order.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Itens do Pedido */}
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-semibold mb-3 text-lg">Itens</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">SKU</th>
                    <th className="text-left py-2">Produto</th>
                    <th className="text-right py-2">Qtd</th>
                    <th className="text-right py-2">Preço Unit.</th>
                    <th className="text-right py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-100">
                      <td className="py-2">{item.sku}</td>
                      <td className="py-2">{item.nome}</td>
                      <td className="text-right py-2">{item.quantidade}</td>
                      <td className="text-right py-2">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(item.preco_unitario)}
                      </td>
                      <td className="text-right py-2 font-semibold">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cálculo de Valores */}
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <h3 className="font-semibold mb-4 text-lg">Resumo Financeiro</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Valor Total dos Itens:</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(order.valor_total)}
                  </span>
                </div>
                {order.valor_frete > 0 && (
                  <div className="flex justify-between">
                    <span>Frete:</span>
                    <span>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(order.valor_frete)}
                    </span>
                  </div>
                )}
                {order.desconto_valor > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>
                      Desconto ({order.desconto_percentual}%):
                    </span>
                    <span>
                      -{new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(order.desconto_valor)}
                    </span>
                  </div>
                )}
                <div className="border-t border-blue-300 pt-3 flex justify-between font-bold text-lg">
                  <span>Valor Líquido:</span>
                  <span>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(order.valor_liquido)}
                  </span>
                </div>
              </div>
            </div>

            {/* Comissões e Repasse */}
            <div className="bg-green-50 p-4 rounded border border-green-200">
              <h3 className="font-semibold mb-4 text-lg">Comissões e Repasse</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Taxa Plataforma MadeiraMadeira ({order.taxa_plataforma_percentual}%):</span>
                  <span className="text-red-600 font-semibold">
                    -{new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(order.taxa_plataforma_valor)}
                  </span>
                </div>
                <div className="border-t border-green-300 pt-3 flex justify-between font-bold text-lg text-green-700">
                  <span>Repasse Líquido:</span>
                  <span>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(order.repasse_liquido)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded"
            >
              Fechar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
