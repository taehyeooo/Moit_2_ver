import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUsers, FaClipboardList, FaEnvelopeOpenText } from 'react-icons/fa';

// 통계 카드 컴포넌트
const StatCard = ({ icon, title, value, color }) => (
    <div className="bg-white p-6 rounded-lg shadow-md flex items-center gap-6">
        <div className={`text-4xl ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
            <p className="text-gray-500">{title}</p>
        </div>
    </div>
);

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        userCount: 0,
        meetingCount: 0,
        contactCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 👇 [수정됨] 백엔드 API 경로를 '/api/admin/dashboard-stats'로 변경
                const response = await axios.get('http://localhost:3000/api/admin/dashboard-stats', { withCredentials: true });
                setStats(response.data);
            } catch (error) {
                console.error("통계 데이터 로딩 실패:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div className="p-8">데이터를 불러오는 중입니다...</div>;

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6 text-gray-800">대시보드</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard icon={<FaUsers />} title="총 사용자 수" value={stats.userCount} color="text-blue-500" />
                <StatCard icon={<FaClipboardList />} title="총 모임 수" value={stats.meetingCount} color="text-green-500" />
                <StatCard icon={<FaEnvelopeOpenText />} title="총 문의 수" value={stats.contactCount} color="text-orange-500" />
            </div>

            <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">관리자 안내</h2>
                <p className="text-gray-600">
                    왼쪽 사이드바 메뉴를 통해 사용자, 모임, 문의 사항을 관리할 수 있습니다.
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-500 space-y-1">
                    <li><strong>사용자 관리:</strong> 가입된 회원을 조회하고 강제 탈퇴시킬 수 있습니다.</li>
                    <li><strong>모임 관리:</strong> 생성된 모임을 모니터링하고 삭제할 수 있습니다.</li>
                    <li><strong>문의 관리:</strong> 접수된 문의사항에 답변을 달거나 상태를 변경할 수 있습니다.</li>
                </ul>
            </div>
        </div>
    );
};

export default AdminDashboard;
