import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaChevronLeft, FaRegListAlt, FaUser } from 'react-icons/fa';
// import defaultCoverImage from '../../assets/moitmark2.jpg'; // 👈 주석 처리
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

// [추가] 백엔드 기본 URL과 대체 이미지 URL 정의
const BACKEND_BASE_URL = 'http://localhost:3000';
const DEFAULT_IMAGE_URL = 'https://via.placeholder.com/1280x320.png?text=No+Cover+Image';

const formatDate = (dateString) => {
    const options = { month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false };
    return new Intl.DateTimeFormat('ko-KR', options).format(new Date(dateString));
};

// [추가] 상대 경로를 절대 경로로 변환하는 함수
const getFullImageUrl = (imagePath) => {
    if (!imagePath) return DEFAULT_IMAGE_URL;
    if (imagePath.startsWith('/uploads')) {
        return `${BACKEND_BASE_URL}${imagePath}`;
    }
    return imagePath;
};

const MeetingDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // 👇 --- [추가] API 요청 로딩 상태와 현재 사용자의 참여 여부 상태 --- 👇
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isParticipant, setIsParticipant] = useState(false);

    useEffect(() => {
        const fetchMeetingDetail = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const response = await axios.get(`/api/meetings/${id}`);
                setMeeting(response.data);
            } catch (err) {
                console.error("모임 상세 정보를 불러오는 데 실패했습니다.", err);
                setError("모임 정보를 불러올 수 없습니다.");
            } finally {
                setLoading(false);
            }
        };
        fetchMeetingDetail();
    }, [id]);

    // 👇 --- [추가] meeting 정보가 업데이트될 때마다 현재 유저의 참여 상태를 갱신 --- 👇
    useEffect(() => {
        if (user && meeting) {
            const isUserParticipant = meeting.participants.some(p => p._id === user._id);
            setIsParticipant(isUserParticipant);
        }
    }, [user, meeting]);

    const handleDeleteMeeting = async () => {
        // ... (기존 삭제 로직은 동일)
        const result = await Swal.fire({
            title: '정말 모임을 삭제하시겠습니까?', text: "삭제된 모임은 되돌릴 수 없습니다!",
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6', confirmButtonText: '네, 삭제하겠습니다', cancelButtonText: '아니요'
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`/api/meetings/${id}`, { withCredentials: true });
                await Swal.fire('삭제 완료!', '모임이 성공적으로 삭제되었습니다.', 'success');
                navigate('/meetings');
            } catch (err) {
                const message = err.response?.data?.message || '모임 삭제 중 오류가 발생했습니다.';
                Swal.fire('오류 발생', message, 'error');
            }
        }
    };

    // 👇 --- [추가] 모임 참여/취소 핸들러 함수 --- 👇
    const handleJoinOrLeaveMeeting = async () => {
        if (!user) {
            Swal.fire('로그인 필요', '모임에 참여하려면 로그인이 필요합니다.', 'warning');
            return navigate('/login');
        }
        setIsSubmitting(true);
        try {
            const endpoint = isParticipant ? `/api/meetings/${id}/leave` : `/api/meetings/${id}/join`;
            const response = await axios.post(endpoint, {}, { withCredentials: true });
            
            setMeeting(response.data.meeting); // 서버로부터 받은 최신 모임 정보로 상태 업데이트
            Swal.fire(isParticipant ? '신청 취소 완료' : '신청 완료!', response.data.message, 'success');
        } catch (err) {
            const message = err.response?.data?.message || '오류가 발생했습니다.';
            Swal.fire('오류', message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="bg-white py-32 min-h-screen flex justify-center pt-16"><p>모임 상세 정보를 불러오는 중...</p></div>;
    }

    if (error || !meeting) {
        return <div className="bg-white py-32 min-h-screen flex justify-center pt-16"><p>{error || "모임을 찾을 수 없습니다."}</p></div>;
    }
    
    const remainingSpots = meeting.maxParticipants - meeting.participants.length;
    const isHost = user && meeting && user._id === meeting.host._id;

    // 👈 [핵심 수정 부분] 이미지 URL 생성
    const imageSource = getFullImageUrl(meeting.coverImage); 
    
    return (
        <div className="bg-white pt-24 pb-12 min-h-screen">
            <div className="container mx-auto max-w-6xl px-4">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-black mb-4">
                    <FaChevronLeft />
                    <span>뒤로가기</span>
                </button>

                <div className="w-full h-80 bg-gray-200 rounded-lg overflow-hidden mb-8">
                    {/* 👇 --- [수정] imageSource 변수를 사용하여 이미지 표시 --- 👇 */}
                    <img 
                        src={imageSource} 
                        alt={meeting.title} 
                        className="w-full h-full object-cover" 
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_IMAGE_URL; }} // 이미지 로드 오류 시 대체 이미지 강제
                    />
                    {/* 👆 ----------------------------------------------------- 👆 */}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                         {/* ... (중략) ... */}
                        <div className='flex items-center justify-between mb-6'>
                            <div className="flex items-center">
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                                    <span className="text-3xl">🎉</span>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">{meeting.title}</h1>
                                </div>
                            </div>
                            {isHost && (
                                <button
                                    onClick={handleDeleteMeeting}
                                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    모임 삭제
                                </button>
                            )}
                        </div>
                        <div className="mb-8">
                            <h2 className="text-xl font-bold mb-3">📝 모임 설명</h2>
                            <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-md">{meeting.description}</p>
                        </div>
                        <div className="mb-8">
                            <h2 className="text-xl font-bold mb-3">📌 핵심 정보</h2>
                            <div className="grid grid-cols-2 gap-4 text-gray-700">
                                <div className="flex items-center p-3 bg-gray-50 rounded-lg"><FaRegListAlt className="mr-3 text-gray-400" size={20} /> <span className='font-semibold'>카테고리:</span>&nbsp;{meeting.category}</div>
                                <div className="flex items-center p-3 bg-gray-50 rounded-lg"><FaUsers className="mr-3 text-gray-400" size={20} /> <span className='font-semibold'>인원:</span>&nbsp;{meeting.participants.length} / {meeting.maxParticipants}명</div>
                                <div className="flex items-center p-3 bg-gray-50 rounded-lg"><FaMapMarkerAlt className="mr-3 text-gray-400" size={20} /> <span className='font-semibold'>장소:</span>&nbsp;{meeting.location}</div>
                                <div className="flex items-center p-3 bg-gray-50 rounded-lg"><FaUser className="mr-3 text-gray-400" size={20} /> <span className='font-semibold'>호스트:</span>&nbsp;{meeting.host.nickname}</div>
                            </div>
                        </div>
                        <h2 className="text-xl font-bold mb-3">👥 참여 멤버 ({meeting.participants.length})</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {meeting.participants.map(p => (
                                <div key={p._id} className="p-3 border rounded-lg bg-gray-50">
                                    <p className="font-semibold">{p.nickname}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="p-6 border border-gray-200 rounded-lg shadow-md sticky top-24">
                            <div className="text-center bg-blue-50 p-4 rounded-lg mb-4">
                                <p className="font-bold text-lg text-blue-800">{formatDate(meeting.date)}</p>
                            </div>
                            
                            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md text-center mb-4">
                                ✅ 더 궁금한점을 모두 해결하세요
                            </div>
                            
                            <p className="text-sm text-gray-500 text-center mb-2">
                                {isParticipant ? '이미 참여하고 있는 모임입니다.' : (remainingSpots > 0 ? `마감까지 ${remainingSpots}자리 남았어요!` : '모집이 마감되었습니다!')}
                            </p>

                            {/* 👇 --- [수정] 버튼 로직 전체 변경 --- 👇 */}
                            <button 
                                onClick={handleJoinOrLeaveMeeting}
                                disabled={(remainingSpots <= 0 && !isParticipant) || isSubmitting || isHost}
                                className={`w-full font-bold py-3 px-4 rounded-lg transition-colors 
                                    ${isHost ? 'bg-gray-400 text-white cursor-not-allowed' : 
                                     isParticipant ? 'bg-red-500 hover:bg-red-600 text-white' : 
                                     'bg-blue-600 hover:bg-blue-700 text-white'}
                                    disabled:bg-gray-400 disabled:cursor-not-allowed`}
                            >
                                {isHost ? '당신은 호스트입니다' : (isSubmitting ? '처리 중...' : (isParticipant ? '신청 취소' : '신청하기'))}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default MeetingDetail;