import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HiMenu, HiX } from "react-icons/hi";
import { useAuth } from "../../context/AuthContext.jsx";
import axios from "axios";

// 👇 --- [수정] '커뮤니티' 메뉴를 '문의하기'로 변경하고 경로를 '/contact'로 수정했습니다. --- 👇
// ...
const menuItems = [
  { path: "/about", label: "소개" },
  { path: "/recommend", label: "취미 추천" },
  { path: "/meetings", label: "모임" },
  { path: "/qna", label: "Q&A" }, // 👈 Q&A 메뉴 추가
  { path: "/contact", label: "문의하기" },
];
// ...

const MenuItem = ({ path, label, onClick, isScrolled, isHomePage, isActive }) => (
    <li>
        <Link
            to={path}
            className={`transition-colors duration-300 ${isActive ? 'text-blue-500 font-bold' : !isScrolled && isHomePage ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'}`}
            onClick={onClick}
        >
            {label}
        </Link>
    </li>
);

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, setUser } = useAuth();

    const isHomePage = location.pathname === "/";
    const toggleMenu = () => setIsOpen(!isOpen);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 10);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handleLogout = async () => {
        try {
            await axios.post('/api/auth/logout', {}, { withCredentials: true });
            setUser(null);
            navigate('/');
        } catch (error) {
            console.error("Logout failed:", error);
            setUser(null);
            navigate('/');
        }
    };
    

    const navClass = `fixed top-0 left-0 w-full p-4 z-50 transition-all duration-300 ${!isScrolled && isHomePage ? "bg-black bg-opacity-20 text-white" : "bg-white text-black shadow-md"}`;

    return (
        <nav className={navClass}>
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-2xl font-bold">
                    <Link to="/" className={!isScrolled && isHomePage ? 'text-blue-400' : 'text-blue-600'}>MOIT</Link>
                </h1>

                <div className="hidden lg:flex flex-1 justify-center">
                    <ul className="flex gap-8 text-lg">
                        {menuItems.map((item) => (
                            <MenuItem key={item.path} {...item} isScrolled={isScrolled} isHomePage={isHomePage} isActive={location.pathname === item.path} />
                        ))}
                    </ul>
                </div>

                <div className="hidden lg:flex items-center gap-4">
                    {user ? (
                        <>
                            <span className={!isScrolled && isHomePage ? 'text-gray-200' : 'text-gray-700'}>
                                환영합니다, {user.nickname || user.username}님!
                            </span>
                            <Link to="/mypage" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-semibold">
                                마이페이지
                            </Link>
                            <button onClick={handleLogout} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className={!isScrolled && isHomePage ? 'hover:text-gray-300' : 'hover:text-gray-700'}>
                                로그인
                            </Link>
                            <Link to="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                회원가입
                            </Link>
                        </>
                    )}
                </div>

                <button className="lg:hidden text-2xl" onClick={toggleMenu} aria-label="메뉴">
                    {isOpen ? <HiX /> : <HiMenu />}
                </button>
            </div>
            {/* 모바일 메뉴도 상태에 따라 변경되도록 수정이 필요하지만, 우선 데스크탑 버전부터 해결합니다. */}
        </nav>
    );
};

export default Navbar;