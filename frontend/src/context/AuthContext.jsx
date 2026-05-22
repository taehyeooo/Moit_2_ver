import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

// 앱 전체에 공유될 저장 공간(Context)을 생성합니다.
const AuthContext = createContext(null);

// Context를 통해 값을 제공하는 Provider 컴포넌트입니다.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const tokenResponse = await axios.post(
          "http://localhost:3000/api/auth/verify-token",
          {},
          { withCredentials: true }
        );
        setUser(tokenResponse.data.user);
      } catch (error) {
        // 페이지 첫 로드 시 토큰이 없는 것은 정상적인 상황이므로 에러 메시지는 콘솔에만 기록합니다.
        console.log("인증 상태 확인 실패 (로그인되지 않은 상태일 수 있습니다).");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkUserStatus();
  }, []); // ❗ 의존성 배열을 비워 이 효과가 컴포넌트가 처음 마운트될 때 한 번만 실행되도록 합니다.

  const value = { user, setUser, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 다른 컴포넌트에서 Context를 쉽게 사용하기 위한 Custom Hook
export const useAuth = () => {
  return useContext(AuthContext);
};