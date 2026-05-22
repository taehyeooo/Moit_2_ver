import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('http://localhost:3000/api/admin/users', { withCredentials: true });
            setUsers(response.data);
        } catch (error) {
            console.error("사용자 목록 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '사용자를 삭제하시겠습니까?',
            text: "삭제 후 복구할 수 없습니다.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:3000/api/admin/users/${id}`, { withCredentials: true });
                setUsers(users.filter(user => user._id !== id));
                Swal.fire('삭제됨', '사용자가 삭제되었습니다.', 'success');
            } catch (error) {
                Swal.fire('실패', '삭제 중 오류가 발생했습니다.', 'error');
            }
        }
    };

    if (loading) return <div className="p-4">로딩 중...</div>;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">👤 사용자 관리</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-100 border-b">
                        <tr>
                            <th className="px-4 py-3">닉네임 (ID)</th>
                            <th className="px-4 py-3">이메일</th>
                            <th className="px-4 py-3">권한</th>
                            <th className="px-4 py-3">가입일</th>
                            <th className="px-4 py-3 text-center">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user._id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">
                                    {user.nickname} <span className="text-gray-400 text-xs">({user.username})</span>
                                </td>
                                <td className="px-4 py-3">{user.email}</td>
                                <td className="px-4 py-3">
                                    {user.role === 1 ? 
                                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">관리자</span> : 
                                        <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">일반</span>
                                    }
                                </td>
                                <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-center">
                                    {user.role !== 1 && (
                                        <button 
                                            onClick={() => handleDelete(user._id)}
                                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminUsers;