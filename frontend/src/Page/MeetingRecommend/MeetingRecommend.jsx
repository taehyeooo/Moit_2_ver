import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaSpinner } from 'react-icons/fa';

// [신규] 모임 카드 컴포넌트
// Meetings.jsx의 카드와 유사하지만, 추천 페이지 내에서 사용하기 위해 별도로 정의합니다.
// (백엔드 Meeting.js 모델에 추가한 필드들을 모두 사용합니다)
const MeetingCard = ({ meeting }) => {
    // 이미지가 없을 경우를 대비한 기본 이미지
    const defaultImage = 'https://via.placeholder.com/400x250.png?text=MOIT';
    
    // 백엔드에서 '/uploads/image.png'와 같은 상대 경로로 이미지 URL을 제공한다고 가정
    const imageUrl = meeting.imageUrl ? meeting.imageUrl : defaultImage;

    // 날짜 포맷팅 (meetingTime이 유효한 Date 문자열이라고 가정)
    const formattedDate = meeting.meetingTime 
        ? new Date(meeting.meetingTime).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '날짜 미정';

    return (
        <Link 
            to={`/meetings/${meeting._id}`} // 클릭 시 모임 상세 페이지로 이동
            className="block bg-white shadow-lg rounded-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1"
        >
            {/* 1. 이미지 영역 */}
            <div className="relative h-48 w-full">
                <img 
                    src={imageUrl} 
                    alt={meeting.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.target.src = defaultImage; }} // 이미지 로드 실패 시 기본 이미지
                />
                <span className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                    {meeting.category}
                </span>
            </div>
            
            {/* 2. 컨텐츠 영역 */}
            <div className="p-6">
                {/* 모임 제목 */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 truncate" title={meeting.title}>
                    {meeting.title}
                </h3>
                
                {/* 모임 설명 (2줄 제한) */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {meeting.description || '모임 설명이 없습니다.'}
                </p>
                
                {/* 3. 상세 정보 (아이콘과 텍스트) */}
                <div className="space-y-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-blue-500 flex-shrink-0" />
                        <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <FaMapMarkerAlt className="text-blue-500 flex-shrink-0" />
                        <span>{meeting.location || '위치 미정'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <FaUsers className="text-blue-500 flex-shrink-0" />
                        <span>
                            {meeting.members.length} / {meeting.maxParticipants || '제한 없음'}명
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

// --- [수정] MeetingRecommend 메인 컴포넌트 ---
const MeetingRecommend = () => {
    const [recommendations, setRecommendations] = useState([]); // AI가 추천한 모임 목록
    const [loading, setLoading] = useState(true); // 로딩 상태
    const [error, setError] = useState(null); // 에러 메시지
    const { user } = useAuth(); // 로그인 사용자 정보

    useEffect(() => {
        // 1. 로그인한 사용자인지 확인
        if (!user) {
            setLoading(false);
            setError('맞춤 모임 추천을 받으려면 로그인이 필요합니다.');
            return;
        }

        // 2. AI 추천 API 호출
        const fetchRecommendations = async () => {
            try {
                setLoading(true);
                // (백엔드 meeting.js에 추가한 /api/meetings/recommend 엔드포인트 호출)
                const response = await axios.get('/api/meetings/recommend', {
                    withCredentials: true, // 쿠키(로그인 토큰) 전송
                });
                
                // 3. 성공 시 상태 업데이트
                setRecommendations(response.data); // (백엔드가 모임 객체의 배열을 반환)
            } catch (err) {
                console.error("추천 모임 로딩 실패:", err);
                // 4. 실패 시 에러 처리 (예: 설문 안함)
                setError(err.response?.data?.message || '추천 모임을 불러오는 데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [user]); // user 객체가 변경될 때(로그인/로그아웃) 다시 실행

    // 5. 로딩/에러/결과에 따라 다른 UI 렌더링
    const renderContent = () => {
        if (loading) {
            return (
                <div className="text-center text-gray-600 flex flex-col items-center justify-center h-64">
                    <FaSpinner className="animate-spin text-4xl text-blue-500 mb-4" />
                    <p className="text-lg font-semibold">AI가 회원님을 위한 모임을</p>
                    <p className="text-lg font-semibold">분석하고 있습니다...</p>
                </div>
            );
        }

        if (error) {
            // (설문조사 404 에러 시 설문조사 페이지로 이동 유도)
            if (error.includes('설문 결과가 없습니다')) {
                return (
                    <div className="text-center text-blue-600 bg-blue-50 p-8 rounded-lg shadow">
                        <h3 className="font-bold text-xl mb-4">{error}</h3>
                        <p className="mb-6">AI 추천을 받기 위해 상세 취미 설문을 먼저 완료해주세요.</p>
                        <Link 
                            to="/hobby-recommend" 
                            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            설문조사 하러 가기
                        </Link>
                    </div>
                );
            }
            // 기타 에러
            return (
                <div className="text-center text-red-600 bg-red-50 p-8 rounded-lg shadow">
                    <h3 className="font-bold text-xl">{error}</h3>
                </div>
            );
        }

        if (recommendations.length === 0) {
            return (
                <div className="text-center text-gray-500 bg-white p-8 rounded-lg shadow">
                    <h3 className="font-bold text-xl">추천할 모임이 아직 없습니다.</h3>
                    <p className="mt-2">새로운 모임이 등록되기를 기다려주세요!</p>
                </div>
            );
        }

        // 6. 추천 결과 표시 (그리드)
        return (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {recommendations.map(meeting => (
                    <MeetingCard key={meeting._id} meeting={meeting} />
                ))}
            </div>
        );
    };

    return (
        <div className="bg-gray-50 py-32 min-h-screen">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-12 text-gray-800">
                    <span className="text-blue-600">{user?.username || '회원'}</span>님을 위한 AI 맞춤 모임
                </h1>
                
                {/* 렌더링 영역 */}
                {renderContent()}
            </div>
        </div>
    );
};

export default MeetingRecommend;