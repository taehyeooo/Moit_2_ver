import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx"; 

const AdminRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>관리자 권한을 확인 중입니다...</div>;
  }

  // [수정 포인트] user.role === 'admin' 이 아니라 숫자 1로 확인해야 합니다.
  if (user && user.role === 1) {
    return <Outlet />;
  }

  // 권한이 없으면 로그인 페이지로 리디렉션
  return <Navigate to="/login" replace />;
};

export default AdminRoute;