import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx'; // 1단계에서 만든 AuthProvider를 가져옵니다.
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* AuthProvider가 App 컴포넌트 전체를 감싸도록 설정합니다.
        이렇게 하면 App 컴포넌트와 그 모든 자식 컴포넌트들이 
        로그인 상태(user), 로딩 상태(loading) 등의 값을 공유할 수 있게 됩니다.
      */}
      <AuthProvider> 
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);