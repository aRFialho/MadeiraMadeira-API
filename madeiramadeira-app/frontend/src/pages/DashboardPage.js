import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, } from 'recharts';
import { dashboardApi } from '../api/endpoints';
export const DashboardPage = () => {
    const [metrics, setMetrics] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [metricsRes, chartRes] = await Promise.all([
                    dashboardApi.getMetrics(),
                    dashboardApi.getSalesChart(30),
                ]);
                setMetrics(metricsRes.data);
                setChartData(chartRes.data);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);
    if (loading)
        return _jsx("div", { className: "p-8 text-center", children: "Loading..." });
    if (error)
        return _jsx("div", { className: "p-8 text-center text-red-600", children: error });
    if (!metrics)
        return _jsx("div", { className: "p-8 text-center", children: "No data" });
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };
    return (_jsx("div", { className: "p-8 bg-gray-50 min-h-screen", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx("h1", { className: "text-3xl font-bold mb-8 text-gray-800", children: "Dashboard" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8", children: [_jsx(MetricCard, { title: "Vendas Hoje", value: formatCurrency(metrics.total_vendas_dia), bgColor: "bg-blue-500" }), _jsx(MetricCard, { title: "Vendas Semana", value: formatCurrency(metrics.total_vendas_semana), bgColor: "bg-green-500" }), _jsx(MetricCard, { title: "Vendas M\u00EAs", value: formatCurrency(metrics.total_vendas_mes), bgColor: "bg-purple-500" }), _jsx(MetricCard, { title: "Proje\u00E7\u00E3o Anual", value: formatCurrency(metrics.projacao_faturamento), bgColor: "bg-orange-500" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8", children: [_jsx(StatCard, { title: "Total Pedidos", value: metrics.total_pedidos }), _jsx(StatCard, { title: "Pedidos Pendentes", value: metrics.pedidos_pendentes }), _jsx(StatCard, { title: "Total Produtos", value: metrics.total_produtos }), _jsx(StatCard, { title: "Produtos em Fila", value: metrics.produtos_em_fila })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsxs("div", { className: "bg-white p-6 rounded-lg shadow", children: [_jsx("h2", { className: "text-lg font-semibold mb-4 text-gray-800", children: "Vendas por Dia" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "data_dia" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "total_vendas", stroke: "#8884d8", name: "Vendas (R$)" })] }) })] }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow", children: [_jsx("h2", { className: "text-lg font-semibold mb-4 text-gray-800", children: "Quantidade de Pedidos" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "data_dia" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Bar, { dataKey: "quantidade_pedidos", fill: "#82ca9d", name: "Pedidos" })] }) })] })] })] }) }));
};
const MetricCard = ({ title, value, bgColor }) => (_jsxs("div", { className: `${bgColor} text-white rounded-lg shadow p-6`, children: [_jsx("p", { className: "text-sm opacity-90", children: title }), _jsx("p", { className: "text-2xl font-bold mt-2", children: value })] }));
const StatCard = ({ title, value }) => (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("p", { className: "text-sm text-gray-600", children: title }), _jsx("p", { className: "text-3xl font-bold mt-2 text-gray-800", children: value })] }));
