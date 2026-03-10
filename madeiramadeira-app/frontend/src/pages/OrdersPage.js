import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { marketplaceApi } from '../api/endpoints';
export const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await marketplaceApi.getOrders(100, page * 100);
                setOrders(response.data.data);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [page]);
    const handleStatusUpdate = async (orderId, newStatus) => {
        try {
            await marketplaceApi.updateOrderStatus(orderId, newStatus);
            setOrders(orders.map((o) => o.id_pedido === orderId ? { ...o, status: newStatus } : o));
        }
        catch (err) {
            setError(err.message);
        }
    };
    const filteredOrders = orders.filter((order) => order.id_pedido.toString().includes(search) ||
        order.status.toLowerCase().includes(search.toLowerCase()));
    if (loading)
        return _jsx("div", { className: "p-8 text-center", children: "Loading..." });
    return (_jsx("div", { className: "p-8 bg-gray-50 min-h-screen", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx("h1", { className: "text-3xl font-bold mb-6 text-gray-800", children: "Pedidos" }), _jsx("div", { className: "mb-6", children: _jsx("input", { type: "text", placeholder: "Buscar por ID ou status...", value: search, onChange: (e) => setSearch(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" }) }), error && (_jsx("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6", children: error })), _jsx("div", { className: "bg-white rounded-lg shadow overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-100 border-b", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "ID Pedido" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Valor" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Data" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "A\u00E7\u00E3o" })] }) }), _jsx("tbody", { children: filteredOrders.map((order) => (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 text-sm text-gray-800", children: order.id_pedido }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-800", children: new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(order.valor_total) }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-600", children: new Date(order.data_pedido).toLocaleDateString('pt-BR') }), _jsx("td", { className: "px-6 py-4 text-sm", children: _jsx("span", { className: `px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : order.status === 'approved'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-green-100 text-green-800'}`, children: order.status }) }), _jsx("td", { className: "px-6 py-4 text-sm", children: _jsxs("select", { value: "", onChange: (e) => {
                                                    if (e.target.value) {
                                                        handleStatusUpdate(order.id_pedido, e.target.value);
                                                    }
                                                }, className: "px-2 py-1 border border-gray-300 rounded text-sm cursor-pointer", children: [_jsx("option", { value: "", children: "Atualizar" }), _jsx("option", { value: "received", children: "Recebido" }), _jsx("option", { value: "invoiced", children: "NF Emitida" }), _jsx("option", { value: "delivered", children: "Entregue" })] }) })] }, order.id))) })] }) }), _jsxs("div", { className: "mt-6 flex justify-between items-center", children: [_jsx("button", { onClick: () => setPage(Math.max(0, page - 1)), disabled: page === 0, className: "px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400", children: "Anterior" }), _jsxs("span", { className: "text-sm text-gray-600", children: ["P\u00E1gina ", page + 1] }), _jsx("button", { onClick: () => setPage(page + 1), className: "px-4 py-2 bg-blue-600 text-white rounded", children: "Pr\u00F3xima" })] })] }) }));
};
