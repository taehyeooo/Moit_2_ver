import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';

const CreateMeeting = () => {
    const [formData, setFormData] = useState({
        title: '',
        category: '운동', // 기본값 설정
        description: '',
        location: '',
        maxParticipants: 10, // 기본값
        date: '',
        time: '',
    });
    const [meetingImage, setMeetingImage] = useState(null); // 이미지 파일
    const [preview, setPreview] = useState(null); // 이미지 미리보기
    
    // [추가] 로딩/제출 상태를 통합 관리
    const [isSubmitting, setIsSubmitting] = useState(false); 
    
    // [추가] 중복 모임 발견 시 강제 생성을 위해 임시로 저장할 데이터
    const [forceCreateData, setForceCreateData] = useState(null); 
    
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setMeetingImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setMeetingImage(null);
            setPreview(null);
        }
    };

    // [추가] 중복 모임 알림을 무시하고 강제 생성하는 함수
    const handleForceCreate = async () => {
        if (!forceCreateData) return;
        
        setIsSubmitting(true);
        Swal.fire({
            title: '모임 생성 중...',
            didOpen: () => { Swal.showLoading(); },
            allowOutsideClick: false
        });

        const { formData: originalFormData, meetingImage: originalMeetingImage, tempCoverImage } = forceCreateData;
        const submitData = new FormData();

        // 1. 텍스트 데이터 추가
        submitData.append('title', originalFormData.title);
        submitData.append('category', originalFormData.category);
        submitData.append('description', originalFormData.description);
        submitData.append('location', originalFormData.location);
        submitData.append('maxParticipants', originalFormData.maxParticipants);
        submitData.append('date', originalFormData.date);
        submitData.append('time', originalFormData.time);
        
        // 2. 임시 파일 경로 또는 원본 이미지 파일 전송
        if (tempCoverImage) {
            submitData.append('tempCoverImage', tempCoverImage); 
        } else if (originalMeetingImage) {
            submitData.append('meetingImage', originalMeetingImage);
        }
        
        try {
            const response = await axios.post('/api/meetings/force-create', submitData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                withCredentials: true,
            });

            Swal.close();
            Swal.fire('생성 완료', '새로운 모임이 생성되었습니다!', 'success');
            navigate(`/meetings/${response.data.meeting._id}`);

        } catch (error) {
            Swal.close();
            console.error('모임 강제 생성 실패:', error);
            Swal.fire('실패', error.response?.data?.message || '모임 생성 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsSubmitting(false);
            setForceCreateData(null); // 데이터 정리
        }
    };

    // [추가] 중복 모임을 표시하는 SweetAlert2 모달 함수
    const showRecommendationModal = (summary, recommendations) => {
        let recListHtml = recommendations.map(rec => `
            <div style="border-bottom: 1px solid #eee; padding: 10px 0; text-align: left;">
                <strong style="color: #1e40af;">${rec.title || '모임 이름 없음'}</strong>
                <p style="margin: 5px 0 0; color: #555; font-size: 0.9em;">
                    ${rec.description || rec.location || '설명 없음'}
                </p>
                <a href="/meetings/${rec.meeting_id}" target="_blank" style="color: #2563eb; text-decoration: none; font-size: 0.8em;">
                    [상세 보기]
                </a>
            </div>
        `).join('');

        Swal.fire({
            title: '⚠️ 유사한 모임이 이미 존재합니다.',
            html: `
                <p style="margin-bottom: 15px; font-weight: 600;">${summary || 'AI가 회원님이 만들려는 모임과 비슷한 모임을 찾았습니다.'}</p>
                <div style="max-height: 200px; overflow-y: auto; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
                    ${recListHtml}
                </div>
                <p style="margin-top: 15px; color: #666; font-size: 0.9em;">그래도 모임을 생성하시겠습니까?</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '✅ 무시하고 생성',
            cancelButtonText: '❌ 추천 모임 확인',
            reverseButtons: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#3085d6',
        }).then((result) => {
            if (result.isConfirmed) {
                // 사용자가 '무시하고 생성'을 선택한 경우
                handleForceCreate();
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                // 사용자가 '추천 모임 확인'을 선택한 경우 (취소)
                setForceCreateData(null); // 저장된 데이터 폐기
            }
        });
    };
    
    // [수정] FormData를 사용한 제출
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            Swal.fire('오류', '로그인이 필요합니다.', 'error');
            return;
        }

        setIsSubmitting(true);

        // 1. FormData 객체 생성
        const submitData = new FormData();
        
        // 2. 폼 데이터 (JSON이 아닌, 필드별로) 추가
        submitData.append('title', formData.title);
        submitData.append('category', formData.category);
        submitData.append('description', formData.description);
        submitData.append('location', formData.location);
        submitData.append('maxParticipants', formData.maxParticipants);
        submitData.append('date', formData.date); // Separate date and time for backend merge
        submitData.append('time', formData.time);
        
        // 3. 이미지 파일 추가
        if (meetingImage) {
            submitData.append('meetingImage', meetingImage); // 'meetingImage'는 백엔드 multer와 일치
        }
        
        try {
            // [수정] /api/meetings 엔드포인트로 FormData 전송
            const response = await axios.post('/api/meetings', submitData, {
                headers: {
                    'Content-Type': 'multipart/form-data', // 중요!
                },
                withCredentials: true,
            });

            if (response.data.action === 'recommend') {
                // 4. [핵심] 중복 모임이 발견된 경우
                const recs = response.data.recommendations;
                
                // 강제 생성 시 재전송할 데이터 저장
                setForceCreateData({
                    formData: formData, 
                    meetingImage: meetingImage,
                    tempCoverImage: response.data.tempCoverImage
                });
                
                showRecommendationModal(recs.summary, recs.recommendations);
                
                setIsSubmitting(false); // 로딩 중단 (모달에서 선택을 기다림)
                return;
            }
            
            // 5. [성공] 모임이 즉시 생성된 경우 (action === 'created')
            Swal.fire('성공', '새로운 모임이 성공적으로 생성되었습니다!', 'success');
            navigate(`/meetings/${response.data.meeting._id}`); // 생성된 모임 상세 페이지로 이동

        } catch (error) {
            console.error('모임 생성 실패:', error);
            Swal.fire('실패', error.response?.data?.message || '모임 생성 중 오류가 발생했습니다.', 'error');
        } finally {
            // 강제 생성 모달이 뜨면 로딩을 여기서 끝내지 않고 모달에서 처리
            if (forceCreateData === null) { 
                setIsSubmitting(false); 
            }
        }
    };

    // (참고) PHP 폼에 있던 카테고리들
    const categories = ['운동', '여행', '음악', '게임', '요리', '독서', '공예', '사진', '기타'];

    return (
        <div className="bg-gray-50 py-32">
            <div className="container mx-auto max-w-2xl p-8 bg-white shadow-lg rounded-lg">
                <h1 className="text-3xl font-bold text-center mb-8">새로운 모임 만들기</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">모임 제목</label>
                        <input type="text" name="title" id="title" required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            onChange={handleChange} value={formData.title} />
                    </div>

                    {/* [신규] 이미지 업로드 필드 */}
                    <div>
                        <label htmlFor="meetingImage" className="block text-sm font-medium text-gray-700">대표 이미지 (선택)</label>
                        <input type="file" name="meetingImage" id="meetingImage" accept="image/*"
                            className="mt-1 block w-full text-sm text-gray-500
                                      file:mr-4 file:py-2 file:px-4
                                      file:rounded-full file:border-0
                                      file:text-sm file:font-semibold
                                      file:bg-blue-50 file:text-blue-700
                                      hover:file:bg-blue-100"
                            onChange={handleFileChange} />
                        {preview && (
                            <div className="mt-4">
                                <img src={preview} alt="미리보기" className="w-full max-h-64 object-cover rounded-lg shadow-md" />
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">카테고리</label>
                        <select name="category" id="category" required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
                            onChange={handleChange} value={formData.category}>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    
                    {/* [신규] 상세 설명 필드 */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">모임 설명</label>
                        <textarea name="description" id="description" rows="4"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            onChange={handleChange} value={formData.description}></textarea>
                    </div>

                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700">위치 (장소)</label>
                        <input type="text" name="location" id="location"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            onChange={handleChange} value={formData.location} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700">최대 인원</label>
                            <input type="number" name="maxParticipants" id="maxParticipants" min="2"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                onChange={handleChange} value={formData.maxParticipants} />
                        </div>
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700">날짜</label>
                            <input type="date" name="date" id="date" required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                onChange={handleChange} value={formData.date} />
                        </div>
                        <div>
                            <label htmlFor="time" className="block text-sm font-medium text-gray-700">시간</label>
                            <input type="time" name="time" id="time" required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                onChange={handleChange} value={formData.time} />
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting}
                        className="w-full py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
                        {isSubmitting ? '처리 중...' : '모임 생성하기'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateMeeting;