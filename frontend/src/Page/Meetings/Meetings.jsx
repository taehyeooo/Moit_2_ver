import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
    FaSmile, FaRunning, FaBook, FaPalette, FaUtensils, FaPlaneDeparture, FaHeart,
    FaChevronDown, FaChevronUp, FaUsers, FaPlus
} from 'react-icons/fa';

const categories = [
    { name: '전체', icon: FaUsers }, 
    { name: '취미 및 여가', icon: FaSmile },
    { name: '운동 및 액티비티', icon: FaRunning }, 
    { name: '성장 및 배움', icon: FaBook },
    { name: '문화 및 예술', icon: FaPalette }, 
    { name: '푸드 및 드링크', icon: FaUtensils },
    { name: '여행 및 탐방', icon: FaPlaneDeparture }, 
    { name: '봉사 및 참여', icon: FaHeart },
];

// 백엔드 기본 URL 정의
const BACKEND_BASE_URL = 'http://localhost:3000';
const DEFAULT_CARD_IMAGE_URL = 'https://via.placeholder.com/400x250.png?text=MOIT+No+Image'; // 카드용 대체 이미지

export default function Meetings() {
  const [meetings, setMeetings] = useState([]); 
  const [filteredMeetings, setFilteredMeetings] = useState([]); 
  
  const [activeCategory, setActiveCategory] = useState('전체');
  // 👈 [핵심 수정] 누락된 상태를 다시 추가하여 ReferenceError 해결
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [aiSummary, setAiSummary] = useState(''); 
  const [activeTab, setActiveTab] = useState('all');
  
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await axios.get('/api/meetings');
      if (Array.isArray(response.data)) {
          setMeetings(response.data);
          setFilteredMeetings(response.data);
      } else {
          setMeetings([]);
          setFilteredMeetings([]);
      }
    } catch (error) {
      console.error("모임 목록 로딩 실패:", error);
    }
  };

  useEffect(() => {
    if (activeCategory === '전체') {
      setFilteredMeetings(meetings);
    } else {
      const filtered = meetings.filter(m => m.category === activeCategory);
      setFilteredMeetings(filtered);
    }
    setActiveTab('all');
  }, [activeCategory, meetings]);

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/meetings/ai-search', { query: searchQuery });
      
      const results = Array.isArray(response.data.results) ? response.data.results : [];
      
      setSearchResults(results);
      setAiSummary(response.data.summary || '');
      setActiveTab('ai');
    } catch (error) {
      console.error("AI 검색 실패:", error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSmartSearch();
  };

  // 이 부분은 이제 정상 작동합니다.
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 7);
  const displayedMeetings = activeTab === 'all' ? filteredMeetings : searchResults;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-10 bg-gray-50 min-h-screen">
      
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">관심사별 정모 일정</h1>
        <Link to="/meetings/create">
            <button className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm">
                <FaPlus /> 새 모임 만들기
            </button>
        </Link>
      </div>

      {/* 카테고리 필터 */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-8 border border-gray-100">
        <div className="flex flex-wrap justify-center gap-3">
            {visibleCategories.map(category => (
                <button 
                    key={category.name} 
                    onClick={() => setActiveCategory(category.name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                        activeCategory === category.name 
                        ? 'bg-gray-800 text-white border-gray-800 shadow-md transform scale-105' 
                        : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                >
                    <category.icon className={activeCategory === category.name ? 'text-white' : 'text-gray-400'} /> 
                    {category.name}
                </button>
            ))}
            {categories.length > 7 && (
                <button onClick={() => setShowAllCategories(!showAllCategories)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent">
                    {showAllCategories ? <><FaChevronUp /> 접기</> : <><FaChevronDown /> 더보기</>}
                </button>
            )}
        </div>
      </div>

      {/* AI 스마트 검색창 */}
      <div className="mb-10">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <div className="relative flex-grow">
            <input
              type="text"
              className="w-full h-14 pl-6 pr-4 rounded-xl border-2 border-blue-100 text-lg text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
              placeholder="AI 스마트 검색: '이번 주말 서울에서 맛집 탐방 모임'처럼 검색해보세요!"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">✨</div>
          </div>
          <button
            onClick={handleSmartSearch}
            disabled={loading}
            className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl shadow-md transition-colors disabled:bg-blue-300 whitespace-nowrap flex items-center gap-2"
          >
             {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'AI 검색'}
          </button>
        </div>
      </div>

      {/* 탭 버튼 */}
      <div className="flex items-center gap-8 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 font-bold text-lg transition-all relative ${
            activeTab === 'all' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {activeCategory === '전체' ? '전체 모임' : `${activeCategory} 모임`}
          {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-900 rounded-t-full" />}
        </button>
        
        <button
          onClick={() => setActiveTab('ai')}
          className={`pb-3 font-bold text-lg transition-all relative flex items-center gap-2 ${
            activeTab === 'ai' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          AI 검색 결과 <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{searchResults.length}</span>
          {activeTab === 'ai' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full" />}
        </button>
      </div>

      {/* AI 요약 메시지 */}
      {activeTab === 'ai' && aiSummary && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-sm flex items-start gap-3">
              <span className="text-xl">🤖</span>
              <p className="leading-relaxed font-medium">{aiSummary}</p>
          </div>
      )}

      {/* 모임 리스트 */}
      {displayedMeetings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedMeetings.map((meeting) => (
            <MeetingCard 
                key={meeting._id} 
                meeting={meeting} 
                isAiResult={activeTab === 'ai'} 
                navigate={navigate} 
            />
          ))}
        </div>
      ) : (
        // [수정] AI 탭이고 결과가 없으면(초기 상태 포함) 아무것도 표시하지 않음 (null)
        activeTab === 'ai' ? null : (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 text-center">
                <div className="text-5xl mb-4">🤔</div>
                <p className="text-gray-500 text-lg font-medium">
                    해당 카테고리에 등록된 모임이 없습니다.
                </p>
            </div>
        )
      )}
    </div>
  );
}

function MeetingCard({ meeting, isAiResult, navigate }) {
  const formatDate = (dateString) => {
    try {
        const date = new Date(dateString);
        return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`;
    } catch {
        return "날짜 정보 없음";
    }
  };

  // 👈 [이미지 로드 로직] 백엔드 URL과 상대 경로를 결합합니다.
  const coverImage = meeting.coverImage;
  const imageSource = coverImage && coverImage.startsWith('/uploads') 
    ? `${BACKEND_BASE_URL}${coverImage}` // 백엔드 URL과 상대 경로 결합
    : DEFAULT_CARD_IMAGE_URL; // 대체 이미지 사용

  return (
    <div 
      onClick={() => navigate(`/meetings/${meeting._id}`)}
      className={`group relative cursor-pointer bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border ${
        isAiResult ? 'border-blue-400 ring-2 ring-blue-100 shadow-lg shadow-blue-100' : 'border-gray-200 shadow-sm'
      }`}
    >
      <div className="relative h-48 overflow-hidden bg-gray-100">
        {/* meeting.coverImage 대신 imageSource 사용 */}
        {imageSource !== DEFAULT_CARD_IMAGE_URL ? (
          <img
            src={imageSource}
            alt={meeting.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            // 이미지 로드 실패 시 대체 이미지 로드
            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_CARD_IMAGE_URL; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-slate-100">
            이미지 없음
          </div>
        )}
        <div className="absolute top-3 left-3 bg-white/90 text-gray-800 text-xs font-bold px-2.5 py-1 rounded-md shadow-sm backdrop-blur-sm">
          {meeting.category}
        </div>
        {isAiResult && (
          <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full shadow-md font-bold flex items-center gap-1 animate-pulse">
            ✨ AI 추천
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-lg text-gray-900 mb-2 truncate leading-tight">{meeting.title}</h3>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10 leading-relaxed">{meeting.description}</p>
        <div className="pt-4 border-t border-gray-100 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                <span>📍</span>
                <span className="truncate">{meeting.location}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>👥</span>
                <span className="font-semibold text-gray-900">
                    {meeting.participants ? meeting.participants.length : 0}
                </span>
                <span className="text-gray-400">/</span>
                <span>{meeting.maxParticipants}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span>🗓️</span>
            <span>{formatDate(meeting.date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}