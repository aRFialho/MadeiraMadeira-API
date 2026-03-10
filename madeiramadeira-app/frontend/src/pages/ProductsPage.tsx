import React, { useEffect, useState } from 'react';
import { marketplaceApi } from '../api/endpoints';
import { Product } from '../types';
import { ProductEditModal } from '../components/ProductEditModal';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [editingBulk, setEditingBulk] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await marketplaceApi.getProducts(100, page * 100);
        setProducts(response.data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [page]);

  const handleProductUpdate = async (sku: string, field: string, value: any) => {
    try {
      await marketplaceApi.updateProduct(sku, { [field]: value });
      setProducts(
        products.map((p) =>
          p.sku === sku ? { ...p, [field]: value } : p
        )
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBulkUpdate = async () => {
    try {
      for (const sku of selectedProducts) {
        await marketplaceApi.updateProduct(sku, {
          preco_por: parseFloat(bulkPrice),
        });
      }
      setProducts(
        products.map((p) =>
          selectedProducts.includes(p.sku)
            ? { ...p, preco_por: parseFloat(bulkPrice) }
            : p
        )
      );
      setSelectedProducts([]);
      setBulkPrice('');
      setEditingBulk(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    // Recarregar produtos
    const fetchProducts = async () => {
      try {
        const response = await marketplaceApi.getProducts(100, page * 100);
        setProducts(response.data.data);
      } catch (err: any) {
        setError(err.message);
      }
    };
    fetchProducts();
  };

  const filteredProducts = products.filter(
    (product) =>
      product.sku.toLowerCase().includes(search.toLowerCase()) ||
      product.nome.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Produtos</h1>

        <div className="mb-6 space-y-4">
          <input
            type="text"
            placeholder="Buscar por SKU ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />

          {selectedProducts.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {selectedProducts.length} produtos selecionados
                </span>
                <button
                  onClick={() => setEditingBulk(!editingBulk)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  {editingBulk ? 'Cancelar' : 'Editar Preço em Lote'}
                </button>
              </div>

              {editingBulk && (
                <div className="mt-4 space-y-2">
                  <input
                    type="number"
                    placeholder="Novo preço"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                  />
                  <button
                    onClick={handleBulkUpdate}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Aplicar para {selectedProducts.length} produtos
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts(filteredProducts.map((p) => p.sku));
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Marca
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Preço De
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Preço Por
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Estoque
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.sku} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.sku)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts([...selectedProducts, product.sku]);
                        } else {
                          setSelectedProducts(
                            selectedProducts.filter((s) => s !== product.sku)
                          );
                        }
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-800">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    <span title={product.nome} className="truncate block">
                      {product.nome}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {product.marca}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(product.preco_de)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(product.preco_por)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {product.estoque} un
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-xs font-semibold">
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      Editar
                    </button>
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

        <ProductEditModal
          product={selectedProduct}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      </div>
    </div>
  );
};
