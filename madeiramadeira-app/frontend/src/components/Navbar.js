import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
export const Navbar = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    return (_jsx("nav", { className: "bg-blue-600 text-white p-4 shadow-lg", children: _jsxs("div", { className: "max-w-7xl mx-auto flex justify-between items-center", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("h1", { className: "text-2xl font-bold", children: "MadeiraMadeira" }), _jsx("span", { className: "text-sm text-blue-100", children: "Dashboard" })] }), _jsx("div", { className: "flex items-center space-x-6", children: user && (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-sm", children: user.username }), _jsx("button", { onClick: handleLogout, className: "bg-red-500 hover:bg-red-600 px-4 py-2 rounded text-sm font-semibold transition", children: "Logout" })] })) })] }) }));
};
