import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AdminMeetings = () => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        try {
            const response = await axios.get('http://localhost:3000/api/admin/meetings', { withCredentials: true });
            setMeetings(response.data);
        } catch (error) {
            console.error("모임 목록 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '모임을 삭제하시겠습니까?',
            text: "부적절한 모임인 경우 삭제해주세요.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:3000/api/admin/meetings/${id}`, { withCredentials: true });
                setMeetings(meetings.filter(meeting => meeting._id !== id));
                Swal.fire('삭제됨', '모임이 삭제되었습니다.', 'success');
            } catch (error) {
                Swal.fire('실패', '삭제 중 오류가 발생했습니다.', 'error');
            }
        }
    };

    if (loading) return <div className="p-4">로딩 중...</div>;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">📅 모임 관리</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-100 border-b">
                        <tr>
                            <th className="px-4 py-3">모임명</th>
                            <th className="px-4 py-3">개설자</th>
                            <th className="px-4 py-3">카테고리</th>
                            <th className="px-4 py-3">날짜</th>
                            <th className="px-4 py-3">참여자</th>
                            <th className="px-4 py-3 text-center">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meetings.map((meeting) => (
                            <tr key={meeting._id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-blue-600 truncate max-w-xs" title={meeting.title}>
                                    <a href={`/meetings/${meeting._id}`} target="_blank" rel="noopener noreferrer">
                                        {meeting.title}
                                    </a>
                                </td>
                                <td className="px-4 py-3">{meeting.host?.nickname || '알수없음'}</td>
                                <td className="px-4 py-3">
                                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                        {meeting.category}
                                    </span>
                                </td>
                                <td className="px-4 py-3">{new Date(meeting.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3">
                                    {meeting.participants?.length || 0} / {meeting.maxParticipants}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button 
                                        onClick={() => handleDelete(meeting._id)}
                                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs"
                                    >
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {meetings.length === 0 && (
                            <tr>
                                <td colSpan="6" className="text-center py-4 text-gray-500">개설된 모임이 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminMeetings;