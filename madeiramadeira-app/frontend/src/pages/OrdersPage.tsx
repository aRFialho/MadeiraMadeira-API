import React, { useEffect, useState } from 'react';
import { marketplaceApi } from '../api/endpoints';
import { Order } from '../types';
import { OrderDetailModal } from '../components/OrderDetailModal';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await marketplaceApi.getOrders(100, page * 100);
        setOrders(response.data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [page]);

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    try {
      await marketplaceApi.updateOrderStatus(orderId, newStatus);
      setOrders(
        orders.map((o) =>
          o.id_pedido === orderId ? { ...o, status: newStatus } : o
        )
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleViewDetail = (orderId: number) => {
    setSelectedOrderId(orderId);
    setShowDetail(true);
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.id_pedido.toString().includes(search) ||
      order.status.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Pedidos</h1>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar por ID ou status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  ID Pedido
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {order.id_pedido}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(order.valor_total)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(order.data_pedido).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : order.status === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => handleViewDetail(order.id_pedido)}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      Detalhe
                    </button>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleStatusUpdate(order.id_pedido, e.target.value);
                        }
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm cursor-pointer"
                    >
                      <option value="">Atualizar</option>
                      <option value="received">Recebido</option>
                      <option value="invoiced">NF Emitida</option>
                      <option value="delivered">Entregue</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">Página {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Próxima
          </button>
        </div>

        <OrderDetailModal
          orderId={selectedOrderId || 0}
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
        />
      </div>
    </div>
  );
};
