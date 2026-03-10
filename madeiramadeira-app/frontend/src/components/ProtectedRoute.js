import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
export const ProtectedRoute = ({ children }) => {
    const { token } = useAuthStore();
    if (!token) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
};
