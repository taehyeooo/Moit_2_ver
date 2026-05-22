import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';

const Signup = () => {
    const [role, setRole] = useState('user'); 
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        adminKey: '' // 관리자 등록 키를 위한 상태
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        try {
            // 서버로 보낼 데이터 객체
            const postData = {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                role: role, // 'user' 또는 'admin' 역할
                adminKey: formData.adminKey, // 관리자 등록 키
                name: formData.username, // User 모델에 맞게 name, nickname 추가
                nickname: formData.username
            };
            
            // 백엔드의 회원가입 API(/api/auth/signup)로 데이터 전송
            await axios.post('/api/auth/signup', postData);

            await Swal.fire({
                icon: 'success',
                title: '회원가입 완료!',
                text: '로그인 페이지로 이동합니다.',
                timer: 1500,
                showConfirmButton: false
            });
            navigate('/login');

        } catch (err) {
            // 서버에서 에러가 발생하면 메시지를 표시
            const message = err.response?.data?.message || '회원가입 중 오류가 발생했습니다.';
            setError(message);
        }
    };
    
    // '일반 회원', '관리자' 탭 스타일을 결정하는 함수
    const getTabClassName = (type) => {
        return `w-1/2 py-3 text-center cursor-pointer font-semibold transition-all duration-300 ${
            role === type
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 border-b-2 border-gray-200 hover:text-gray-800'
        }`;
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full mx-auto">
                 <div className="text-center mb-6">
                    <Link to="/" className="text-5xl font-bold text-blue-600 tracking-wider">MOIT</Link>
                    <p className="mt-3 text-lg text-gray-500">새로운 여정을 시작해보세요</p>
                </div>
                
                <div className="bg-white py-8 px-6 sm:px-10 shadow-xl rounded-2xl">
                    <h2 className="text-center text-3xl font-bold text-gray-800 mb-6">회원가입</h2>

                    <div className="flex mb-6">
                        <div onClick={() => setRole('user')} className={getTabClassName('user')}>
                            일반 회원
                        </div>
                        <div onClick={() => setRole('admin')} className={getTabClassName('admin')}>
                            관리자
                        </div>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div>
                            <label className="text-sm font-medium text-gray-700">이름 (아이디)</label>
                            <input 
                                name="username" 
                                type="text" 
                                required 
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="사용자 아이디"
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">이메일</label>
                            <input 
                                name="email" 
                                type="email" 
                                required 
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Email"
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">비밀번호</label>
                            <input 
                                name="password" 
                                type="password" 
                                required 
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Password"
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">비밀번호 확인</label>
                            <input 
                                name="confirmPassword" 
                                type="password" 
                                required 
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm Password"
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        
                        {/* '관리자' 탭을 선택했을 때만 인증 코드 입력창이 나타납니다. */}
                        {role === 'admin' && (
                            <div>
                                <label className="text-sm font-medium text-gray-700">관리자 등록 키</label>
                                <input 
                                    name="adminKey" 
                                    type="password" 
                                    required={role === 'admin'} 
                                    value={formData.adminKey} 
                                    onChange={handleChange} 
                                    placeholder="Admin Registration Key"
                                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                            </div>
                        )}

                        {error && <p className="text-sm text-red-600 text-center font-semibold pt-2">{error}</p>}

                        <div className="pt-2">
                            <button type="submit"
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105">
                                가입하기
                            </button>
                        </div>
                    </form>
                </div>
                 <p className="mt-6 text-center text-sm text-gray-600">
                    이미 계정이 있으신가요? <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">로그인</Link>
                </p>
                 <p className="mt-2 text-center text-sm text-gray-600">
                    <Link to="/" className="font-medium text-gray-500 hover:text-gray-700 transition-colors">홈으로 돌아가기</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;