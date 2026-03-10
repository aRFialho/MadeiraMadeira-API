import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '../api/endpoints';
import { Dashboard as DashboardType, SalesData } from '../types';

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardType | null>(null);
  const [chartData, setChartData] = useState<SalesData[]>([]);
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
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!metrics) return <div className="p-8 text-center">No data</div>;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Vendas Hoje"
            value={formatCurrency(metrics.total_vendas_dia)}
            bgColor="bg-blue-500"
          />
          <MetricCard
            title="Vendas Semana"
            value={formatCurrency(metrics.total_vendas_semana)}
            bgColor="bg-green-500"
          />
          <MetricCard
            title="Vendas Mês"
            value={formatCurrency(metrics.total_vendas_mes)}
            bgColor="bg-purple-500"
          />
          <MetricCard
            title="Projeção Anual"
            value={formatCurrency(metrics.projacao_faturamento)}
            bgColor="bg-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Pedidos" value={metrics.total_pedidos} />
          <StatCard title="Pedidos Pendentes" value={metrics.pedidos_pendentes} />
          <StatCard title="Total Produtos" value={metrics.total_produtos} />
          <StatCard title="Produtos em Fila" value={metrics.produtos_em_fila} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Vendas por Dia
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data_dia" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total_vendas"
                  stroke="#8884d8"
                  name="Vendas (R$)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Quantidade de Pedidos
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data_dia" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="quantidade_pedidos"
                  fill="#82ca9d"
                  name="Pedidos"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  bgColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, bgColor }) => (
  <div className={`${bgColor} text-white rounded-lg shadow p-6`}>
    <p className="text-sm opacity-90">{title}</p>
    <p className="text-2xl font-bold mt-2">{value}</p>
  </div>
);

interface StatCardProps {
  title: string;
  value: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <p className="text-sm text-gray-600">{title}</p>
    <p className="text-3xl font-bold mt-2 text-gray-800">{value}</p>
  </div>
);
