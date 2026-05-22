import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaUserCircle, FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaStar, FaHistory } from 'react-icons/fa';

// 👈 [추가] 백엔드 기본 URL 및 카드용 기본 이미지 URL 정의
const BACKEND_BASE_URL = 'http://localhost:3000';
const DEFAULT_CARD_IMAGE_URL = 'https://via.placeholder.com/400x250.png?text=MOIT+No+Image';

export default function MyPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    
    // 상태 관리
    const [hostedMeetings, setHostedMeetings] = useState([]);
    const [joinedMeetings, setJoinedMeetings] = useState([]);
    const [surveyResult, setSurveyResult] = useState(null); // 취미 추천 결과
    const [activeTab, setActiveTab] = useState('hosted'); // 'hosted' | 'joined' | 'recommendation'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. 마이페이지 기본 데이터 (모임 정보)
                const response = await axios.get('/api/auth/mypage');
                setHostedMeetings(response.data.hostedMeetings || []);
                setJoinedMeetings(response.data.joinedMeetings || []);

                // 2. 취미 추천 기록 데이터
                try {
                    const surveyResponse = await axios.get('/api/survey');
                    if (surveyResponse.data && surveyResponse.data.recommendations) {
                        setSurveyResult(surveyResponse.data.recommendations);
                    }
                } catch (err) {
                    console.log("아직 취미 추천 기록이 없습니다.");
                }

            } catch (error) {
                console.error("마이페이지 데이터 로딩 실패:", error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        }
    }, [user]);

    const handleLogout = async () => {
        try {
            await axios.post('/api/auth/logout');
            logout();
            navigate('/');
        } catch (error) {
            console.error("로그아웃 실패:", error);
        }
    };

    if (!user) return null;
    if (loading) return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;

    return (
        // [수정] py-10 -> pt-28 pb-10 으로 변경하여 상단 여백 확보 (네비바에 가려지지 않음)
        <div className="max-w-5xl mx-auto px-4 pt-28 pb-10 min-h-screen">
            {/* --- 프로필 섹션 --- */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-6xl border-4 border-white shadow-md overflow-hidden">
                    {user.image ? <img src={user.image} alt="Profile" className="w-full h-full object-cover" /> : <FaUserCircle />}
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.nickname || user.name}님, 안녕하세요! 👋</h1>
                    <p className="text-gray-500 mb-6">{user.email}</p>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                        <Link to="/profile/edit" className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                            프로필 수정
                        </Link>
                        <button onClick={handleLogout} className="px-5 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors">
                            로그아웃
                        </button>
                    </div>
                </div>
            </div>

            {/* --- 탭 메뉴 --- */}
            <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('hosted')}
                    className={`pb-4 px-6 text-lg font-bold transition-all whitespace-nowrap ${
                        activeTab === 'hosted' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    내가 만든 모임 ({hostedMeetings.length})
                </button>
                <button
                    onClick={() => setActiveTab('joined')}
                    className={`pb-4 px-6 text-lg font-bold transition-all whitespace-nowrap ${
                        activeTab === 'joined' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    참여한 모임 ({joinedMeetings.length})
                </button>
                {/* [추가된 탭] 취미 추천 기록 */}
                <button
                    onClick={() => setActiveTab('recommendation')}
                    className={`pb-4 px-6 text-lg font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'recommendation' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <FaHistory /> 취미 추천 기록
                </button>
            </div>

            {/* --- 탭 컨텐츠 --- */}
            <div>
                {/* 1. 내가 만든 모임 */}
                {activeTab === 'hosted' && (
                    hostedMeetings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {hostedMeetings.map(meeting => <MeetingCard key={meeting._id} meeting={meeting} />)}
                        </div>
                    ) : (
                        <EmptyState message="아직 만든 모임이 없습니다." link="/meetings/create" linkText="모임 만들기" />
                    )
                )}

                {/* 2. 참여한 모임 */}
                {activeTab === 'joined' && (
                    joinedMeetings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {joinedMeetings.map(meeting => <MeetingCard key={meeting._id} meeting={meeting} />)}
                        </div>
                    ) : (
                        <EmptyState message="아직 참여한 모임이 없습니다." link="/meetings" linkText="모임 찾아보기" />
                    )
                )}

                {/* 3. 취미 추천 기록 */}
                {activeTab === 'recommendation' && (
                    surveyResult && surveyResult.length > 0 ? (
                        <div className="animate-fade-in">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">AI가 분석한 추천 취미</h3>
                                    <p className="text-gray-500 text-sm mt-1">최근 설문을 바탕으로 추천된 결과입니다.</p>
                                </div>
                                <Link to="/hobby-recommend" className="text-sm text-blue-600 hover:underline font-medium">
                                    다시 분석하기 →
                                </Link>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {surveyResult.map((hobby, index) => (
                                    <div key={index} className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start">
                                        <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl">
                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                        </div>
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-lg font-bold text-gray-900">{hobby.name_ko || hobby.title}</h4>
                                                {hobby.score_total && (
                                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold">
                                                        {Math.round(hobby.score_total)}% 추천
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                                {hobby.short_desc || hobby.description}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {hobby.reason && typeof hobby.reason === 'string' && 
                                                    hobby.reason.split(' · ').map((tag, i) => (
                                                        <span key={i} className="bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded text-xs">
                                                            {tag.trim()}
                                                        </span>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState 
                            message="아직 취미 성향 분석을 하지 않으셨네요!" 
                            subMessage="AI에게 나만의 맞춤 취미를 추천받아보세요."
                            link="/hobby-recommend" 
                            linkText="취미 추천 받으러 가기" 
                        />
                    )
                )}
            </div>
        </div>
    );
}

// --- 하위 컴포넌트들 ---

function MeetingCard({ meeting }) {
    const formatDate = (dateString) => {
        try { return new Date(dateString).toLocaleDateString('ko-KR'); } catch { return ""; }
    };

    // 👈 [핵심 수정 부분] 이미지 URL 생성
    const coverImage = meeting.coverImage;
    const imageSource = coverImage && coverImage.startsWith('/uploads') 
        ? `${BACKEND_BASE_URL}${coverImage}` // 백엔드 URL과 상대 경로 결합
        : DEFAULT_CARD_IMAGE_URL; // 대체 이미지 사용

    return (
        <Link to={`/meetings/${meeting._id}`} className="block group">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="h-40 bg-gray-100 relative overflow-hidden">
                    {/* 👇 --- [수정] imageSource 변수를 사용하여 이미지 표시 --- 👇 */}
                    {imageSource !== DEFAULT_CARD_IMAGE_URL ? (
                        <img 
                            src={imageSource} 
                            alt={meeting.title} 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_CARD_IMAGE_URL; }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-slate-100">이미지 없음</div>
                    )}
                    {/* 👆 ----------------------------------------------------- 👆 */}
                    <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        {meeting.category}
                    </div>
                </div>
                <div className="p-5">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 truncate">{meeting.title}</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <FaMapMarkerAlt className="text-gray-400" /> <span className="truncate">{meeting.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FaCalendarAlt className="text-gray-400" /> <span>{formatDate(meeting.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FaUsers className="text-gray-400" /> 
                            <span>{meeting.participants?.length || 0} / {meeting.maxParticipants}명</span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}

function EmptyState({ message, subMessage, link, linkText }) {
    return (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500 text-lg font-medium mb-2">{message}</p>
            {subMessage && <p className="text-gray-400 text-sm mb-6">{subMessage}</p>}
            {link && (
                <Link to={link} className="inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
                    {linkText}
                </Link>
            )}
        </div>
    );
}