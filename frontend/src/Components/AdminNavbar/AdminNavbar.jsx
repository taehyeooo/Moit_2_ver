import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import axios from "axios";

const AdminLayout = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post("http://localhost:3000/api/auth/logout", {}, { withCredentials: true });
      setUser(null);
      navigate("/admin");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white shadow-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">
            <Link to="/admin/posts">관리자 페이지</Link>
          </h1>
          <div className="flex items-center">
            <span className="mr-4">안녕하세요, {user?.username}님</span>
            <nav className="flex items-center space-x-4">
              <Link to="/admin/posts" className="hover:text-gray-300">게시글 관리</Link>
              <Link to="/admin/contacts" className="hover:text-gray-300">문의 관리</Link>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md text-sm font-medium"
              >
                로그아웃
              </button>
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">
        <Outlet /> {/* 자식 라우트(게시글, 문의 관리 페이지 등)가 여기에 렌더링됩니다. */}
      </main>
    </div>
  );
};

export default AdminLayout;
