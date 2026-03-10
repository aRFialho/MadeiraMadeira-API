import React, { useState } from 'react';
import { DashboardPage } from './DashboardPage';
import { OrdersPage } from './OrdersPage';
import { ProductsPage } from './ProductsPage';
import { Navbar } from '../components/Navbar';

type TabType = 'dashboard' | 'orders' | 'products';

export const MainPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <div>
      <Navbar />
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'orders', label: 'Pedidos' },
              { id: 'products', label: 'Produtos' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'orders' && <OrdersPage />}
        {activeTab === 'products' && <ProductsPage />}
      </div>
    </div>
  );
};
