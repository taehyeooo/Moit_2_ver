import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaTachometerAlt,
  FaUsers,
  FaClipboardList,
  FaComments,
  FaSignOutAlt,
} from "react-icons/fa";

const AdminLayout = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout", {}, { withCredentials: true });
      setUser(null);
      navigate("/");
      Swal.fire("로그아웃", "성공적으로 로그아웃되었습니다.", "success");
    } catch (error) {
      console.error("Logout Error:", error);
      Swal.fire("오류", "로그아웃 중 문제가 발생했습니다.", "error");
    }
  };

  const navLinkClasses = ({ isActive }) =>
    `flex items-center px-4 py-3 text-gray-200 rounded-lg transition-colors duration-200 ${
      isActive
        ? "bg-gray-700 text-white"
        : "hover:bg-gray-700 hover:text-white"
    }`;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white flex-shrink-0 flex flex-col">
        <div className="h-20 flex items-center justify-center border-b border-gray-700">
          <Link to="/" className="text-2xl font-bold text-white">
            MOIT Admin
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavLink to="/admin" end className={navLinkClasses}>
            <FaTachometerAlt className="mr-3" />
            대시보드
          </NavLink>
          <NavLink to="/admin/users" className={navLinkClasses}>
            <FaUsers className="mr-3" />
            사용자 관리
          </NavLink>
          <NavLink to="/admin/meetings" className={navLinkClasses}>
            <FaClipboardList className="mr-3" />
            모임 관리
          </NavLink>
          
          {/* 👇 게시물 관리 메뉴 제거됨 */}
          {/* <NavLink to="/admin/posts" className={navLinkClasses}>
            <FaClipboardList className="mr-3" />
            게시물 관리
          </NavLink> */}

          <NavLink to="/admin/contacts" className={navLinkClasses}>
            <FaComments className="mr-3" />
            문의 관리
          </NavLink>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-200 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
          >
            <FaSignOutAlt className="mr-3" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-4">
          <div className="flex justify-end items-center">
            <span className="text-gray-600">
              환영합니다, <strong>{user?.nickname || user?.username}</strong> 님
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;