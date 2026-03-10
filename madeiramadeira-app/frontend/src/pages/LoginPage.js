import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/endpoints';
export const LoginPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser } = useAuthStore();
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                const response = await authApi.login(username, password);
                setUser({ userId: response.data.token, username, email }, response.data.token);
            }
            else {
                const response = await authApi.register(username, email, password);
                setUser({ userId: response.data.token, username, email }, response.data.token);
            }
            navigate('/dashboard');
        }
        catch (err) {
            setError(err.response?.data?.error || 'An error occurred');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-white rounded-lg shadow-2xl p-8 w-full max-w-md", children: [_jsx("h1", { className: "text-3xl font-bold text-center mb-8 text-gray-800", children: "MadeiraMadeira" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Username" }), _jsx("input", { type: "text", value: username, onChange: (e) => setUsername(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none", required: true })] }), !isLogin && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none", required: true })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none", required: true })] }), error && (_jsx("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded", children: error })), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400", children: loading ? 'Loading...' : isLogin ? 'Login' : 'Register' })] }), _jsx("div", { className: "mt-6 text-center", children: _jsx("button", { onClick: () => {
                            setIsLogin(!isLogin);
                            setError('');
                        }, className: "text-sm text-blue-600 hover:text-blue-800 font-medium", children: isLogin
                            ? "Don't have an account? Register"
                            : 'Already have an account? Login' }) })] }) }));
};
