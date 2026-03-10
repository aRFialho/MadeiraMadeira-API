import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DashboardPage } from './DashboardPage';
import { OrdersPage } from './OrdersPage';
import { ProductsPage } from './ProductsPage';
import { Navbar } from '../components/Navbar';
export const MainPage = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    return (_jsxs("div", { children: [_jsx(Navbar, {}), _jsx("div", { className: "bg-white border-b border-gray-200 sticky top-0 z-10", children: _jsx("div", { className: "max-w-7xl mx-auto px-8", children: _jsx("div", { className: "flex space-x-8", children: [
                            { id: 'dashboard', label: 'Dashboard' },
                            { id: 'orders', label: 'Pedidos' },
                            { id: 'products', label: 'Produtos' },
                        ].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab.id), className: `py-4 px-2 border-b-2 font-medium text-sm transition ${activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-800'}`, children: tab.label }, tab.id))) }) }) }), _jsxs("div", { children: [activeTab === 'dashboard' && _jsx(DashboardPage, {}), activeTab === 'orders' && _jsx(OrdersPage, {}), activeTab === 'products' && _jsx(ProductsPage, {})] })] }));
};
