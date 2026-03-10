import React from "react";
import { useAuthStore } from "../stores/authStore";

export const Navbar: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <nav className="bg-blue-600 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">MadeiraMadeira</h1>
          <span className="text-sm text-blue-100">Dashboard</span>
        </div>
        <div className="flex items-center space-x-6">
          {user && (
            <>
              <span className="text-sm">{user.username}</span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
