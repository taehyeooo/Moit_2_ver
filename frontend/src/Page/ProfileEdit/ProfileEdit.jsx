import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';

const ProfileEdit = () => {
    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const [formData, setFormData] = useState({
        nickname: '',
        email: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({ ...prev, nickname: user.nickname, email: user.email }));
            setLoading(false);
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (formData.newPassword && formData.newPassword !== formData.confirmNewPassword) {
            Swal.fire('오류', '새 비밀번호가 일치하지 않습니다.', 'error');
            return;
        }

        try {
            const payload = {
                nickname: formData.nickname,
                email: formData.email,
            };
            
            if (formData.newPassword) {
                payload.currentPassword = formData.currentPassword;
                payload.newPassword = formData.newPassword;
            }

            const response = await axios.put('/api/auth/profile', payload, { withCredentials: true });
            
            setUser(response.data.user); // AuthContext의 유저 정보 업데이트
            
            await Swal.fire('성공!', '프로필 정보가 성공적으로 수정되었습니다.', 'success');
            navigate('/mypage');

        } catch (err) {
            const message = err.response?.data?.message || '프로필 수정 중 오류가 발생했습니다.';
            Swal.fire('오류', message, 'error');
        }
    };

    if (loading) return <div>로딩중...</div>;

    return (
        <div className="min-h-screen bg-gray-100 py-32">
            <div className="container mx-auto px-4 max-w-2xl">
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg space-y-6">
                    <h1 className="text-3xl font-bold text-center text-gray-800">프로필 수정</h1>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">닉네임</label>
                        <input type="text" name="nickname" value={formData.nickname} onChange={handleChange} required
                               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required
                               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>

                    <div className="border-t pt-6 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-700">비밀번호 변경 (선택)</h2>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
                            <input type="password" name="currentPassword" value={formData.currentPassword} onChange={handleChange}
                                   placeholder="비밀번호를 변경하려면 현재 비밀번호를 입력하세요."
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                            <input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange}
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
                            <input type="password" name="confirmNewPassword" value={formData.confirmNewPassword} onChange={handleChange}
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={() => navigate('/mypage')}
                                className="w-full bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">
                            취소
                        </button>
                        <button type="submit"
                                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                            수정하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileEdit;