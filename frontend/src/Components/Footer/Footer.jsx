import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">MOIT 소개</h3>
            <p className="text-gray-400">
              MOIT는 취미를 통해 사람들을 연결하는 모임 플랫폼입니다. 새로운 관심사를 발견하고, 좋은 사람들과 함께 즐거운 시간을 보내세요.
            </p>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-4">빠른 링크</h3>
            <ul className="space-y-2">
              <li><Link to="/" onClick={scrollToTop} className="hover:text-white transition-colors">홈</Link></li>
              <li><Link to="/about" onClick={scrollToTop} className="hover:text-white transition-colors">소개</Link></li>
              <li><Link to="/recommend" onClick={scrollToTop} className="hover:text-white transition-colors">취미 추천</Link></li>
              <li><Link to="/meetings" onClick={scrollToTop} className="hover:text-white transition-colors">모임</Link></li>
              {/* 👇 --- [수정] '커뮤니티'를 '문의하기'로 변경하고, 경로를 '/contact'로 수정했습니다. --- 👇 */}
              <li><Link to="/contact" onClick={scrollToTop} className="hover:text-white transition-colors">문의하기</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-4">고객 지원</h3>
            <ul className="space-y-2 text-gray-400">
              <li>문의/제휴</li>
              <li>이메일: contact@moit.com</li>
              <li>운영 시간: 평일 10:00 - 18:00</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-4">소셜 미디어</h3>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FaFacebook size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FaTwitter size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FaInstagram size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FaLinkedin size={20} />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2024 MOIT. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;