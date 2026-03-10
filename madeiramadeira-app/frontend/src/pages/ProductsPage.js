import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { marketplaceApi } from '../api/endpoints';
export const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [editingBulk, setEditingBulk] = useState(false);
    const [bulkPrice, setBulkPrice] = useState('');
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await marketplaceApi.getProducts(100, page * 100);
                setProducts(response.data.data);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [page]);
    const handleProductUpdate = async (sku, field, value) => {
        try {
            await marketplaceApi.updateProduct(sku, { [field]: value });
            setProducts(products.map((p) => p.sku === sku ? { ...p, [field]: value } : p));
        }
        catch (err) {
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
            setProducts(products.map((p) => selectedProducts.includes(p.sku)
                ? { ...p, preco_por: parseFloat(bulkPrice) }
                : p));
            setSelectedProducts([]);
            setBulkPrice('');
            setEditingBulk(false);
        }
        catch (err) {
            setError(err.message);
        }
    };
    const filteredProducts = products.filter((product) => product.sku.toLowerCase().includes(search.toLowerCase()) ||
        product.nome.toLowerCase().includes(search.toLowerCase()));
    if (loading)
        return _jsx("div", { className: "p-8 text-center", children: "Loading..." });
    return (_jsx("div", { className: "p-8 bg-gray-50 min-h-screen", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx("h1", { className: "text-3xl font-bold mb-6 text-gray-800", children: "Produtos" }), _jsxs("div", { className: "mb-6 space-y-4", children: [_jsx("input", { type: "text", placeholder: "Buscar por SKU ou nome...", value: search, onChange: (e) => setSearch(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" }), selectedProducts.length > 0 && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-sm font-medium text-blue-900", children: [selectedProducts.length, " produtos selecionados"] }), _jsx("button", { onClick: () => setEditingBulk(!editingBulk), className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm", children: editingBulk ? 'Cancelar' : 'Editar em Lote' })] }), editingBulk && (_jsxs("div", { className: "mt-4 space-y-2", children: [_jsx("input", { type: "number", placeholder: "Novo pre\u00E7o", value: bulkPrice, onChange: (e) => setBulkPrice(e.target.value), step: "0.01", className: "w-full px-4 py-2 border border-gray-300 rounded" }), _jsx("button", { onClick: handleBulkUpdate, className: "w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700", children: "Aplicar" })] }))] }))] }), error && (_jsx("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6", children: error })), _jsx("div", { className: "bg-white rounded-lg shadow overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-100 border-b", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left", children: _jsx("input", { type: "checkbox", checked: selectedProducts.length === filteredProducts.length && filteredProducts.length > 0, onChange: (e) => {
                                                    if (e.target.checked) {
                                                        setSelectedProducts(filteredProducts.map((p) => p.sku));
                                                    }
                                                    else {
                                                        setSelectedProducts([]);
                                                    }
                                                }, className: "rounded" }) }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "SKU" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Nome" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Pre\u00E7o De" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Pre\u00E7o Por" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Estoque" }), _jsx("th", { className: "px-6 py-3 text-left text-sm font-semibold text-gray-700", children: "Status" })] }) }), _jsx("tbody", { children: filteredProducts.map((product) => (_jsxs("tr", { className: "border-b hover:bg-gray-50", children: [_jsx("td", { className: "px-4 py-4", children: _jsx("input", { type: "checkbox", checked: selectedProducts.includes(product.sku), onChange: (e) => {
                                                    if (e.target.checked) {
                                                        setSelectedProducts([...selectedProducts, product.sku]);
                                                    }
                                                    else {
                                                        setSelectedProducts(selectedProducts.filter((s) => s !== product.sku));
                                                    }
                                                }, className: "rounded" }) }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-800", children: product.sku }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-800", children: product.nome }), _jsx("td", { className: "px-6 py-4 text-sm", children: _jsx("input", { type: "number", value: product.preco_de, onChange: (e) => handleProductUpdate(product.sku, 'preco_de', parseFloat(e.target.value)), step: "0.01", className: "px-2 py-1 border border-gray-300 rounded w-24" }) }), _jsx("td", { className: "px-6 py-4 text-sm", children: _jsx("input", { type: "number", value: product.preco_por, onChange: (e) => handleProductUpdate(product.sku, 'preco_por', parseFloat(e.target.value)), step: "0.01", className: "px-2 py-1 border border-gray-300 rounded w-24" }) }), _jsx("td", { className: "px-6 py-4 text-sm", children: _jsx("input", { type: "number", value: product.estoque, onChange: (e) => handleProductUpdate(product.sku, 'estoque', parseInt(e.target.value)), className: "px-2 py-1 border border-gray-300 rounded w-20" }) }), _jsx("td", { className: "px-6 py-4 text-sm", children: _jsx("span", { className: "px-3 py-1 bg-gray-100 text-gray-800 rounded text-xs font-semibold", children: product.status }) })] }, product.sku))) })] }) }), _jsxs("div", { className: "mt-6 flex justify-between items-center", children: [_jsx("button", { onClick: () => setPage(Math.max(0, page - 1)), disabled: page === 0, className: "px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400", children: "Anterior" }), _jsxs("span", { className: "text-sm text-gray-600", children: ["P\u00E1gina ", page + 1] }), _jsx("button", { onClick: () => setPage(page + 1), className: "px-4 py-2 bg-blue-600 text-white rounded", children: "Pr\u00F3xima" })] })] }) }));
};
