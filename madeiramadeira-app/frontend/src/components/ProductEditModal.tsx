import React, { useEffect, useState } from 'react';
import { marketplaceApi } from '../api/endpoints';
import { Product } from '../types';

interface ProductEditModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product && isOpen) {
      setFormData({ ...product });
    }
  }, [product, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'preco_de' || name === 'preco_por' || name === 'estoque'
          ? parseFloat(value)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await marketplaceApi.updateProduct(product!.sku, formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Editar Produto</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU
              </label>
              <input
                type="text"
                value={formData.sku || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marca
              </label>
              <input
                type="text"
                name="marca"
                value={formData.marca || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Produto
            </label>
            <input
              type="text"
              name="nome"
              value={formData.nome || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <textarea
              name="descricao"
              value={formData.descricao || ''}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                EAN
              </label>
              <input
                type="text"
                name="ean"
                value={formData.ean || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Produto Seller
              </label>
              <input
                type="text"
                value={formData.id_produto_seller || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preço De (R$)
              </label>
              <input
                type="number"
                name="preco_de"
                step="0.01"
                value={formData.preco_de || 0}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preço Por (R$)
              </label>
              <input
                type="number"
                name="preco_por"
                step="0.01"
                value={formData.preco_por || 0}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estoque (un)
              </label>
              <input
                type="number"
                name="estoque"
                value={formData.estoque || 0}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded mt-6">
            <h3 className="font-semibold mb-2">Desconto</h3>
            <p className="text-sm text-gray-600">
              Desconto: {formData.preco_de && formData.preco_por
                ? (((formData.preco_de - formData.preco_por) / formData.preco_de) * 100).toFixed(1)
                : 0}%
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
