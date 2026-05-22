const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { verifyToken } = require('../utils/auth'); // 👈 [수정 완료: 중복 require 제거]
const axios = require('axios');
const multer = require('multer');
const path = require('path');

// --- Multer 설정 (파일 저장소 정의) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 파일을 저장할 로컬 디렉토리
        cb(null, 'uploads/'); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // 파일 이름: 현재시간-랜덤숫자.원본확장자
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// AI 서버 주소 (Python 서버 포트와 일치해야 함 - AI폴더의 main.py가 실행되는 주소)
const AI_AGENT_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';

// 모든 모임 목록 조회
router.get('/', async (req, res) => {
    try {
        const meetings = await Meeting.find()
            .populate('host', 'nickname')
            .populate('participants')
            .sort({ createdAt: -1 });
        res.json(meetings);
    } catch (error) {
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 마감 임박 모임 조회 API
router.get('/closing-soon', async (req, res) => {
    try {
        const now = new Date();
        const meetings = await Meeting.aggregate([
            {
                $match: {
                    date: { $gte: now }, 
                    $expr: { $lt: [{ $size: "$participants" }, "$maxParticipants"] }
                }
            },
            { $sort: { date: 1 } },
            { $limit: 4 }
        ]);

        const populatedMeetings = await Meeting.populate(meetings, [
            { path: 'host', select: 'nickname' },
            { path: 'participants', select: 'nickname' }
        ]);

        res.json(populatedMeetings);
    } catch (error) {
        console.error("마감 임박 모임 조회 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


// 특정 모임 상세 정보 조회 API
router.get('/:id', async (req, res) => {
    try {
        const meetingId = req.params.id;
        // id가 ObjectId 형식이 아니거나(예: "ai-search"), 너무 짧으면 400 에러 처리 (안전장치)
        if (!meetingId.match(/^[0-9a-fA-F]{24}$/)) {
             return res.status(404).json({ message: '유효하지 않은 모임 ID입니다.' });
        }

        const meeting = await Meeting.findById(meetingId)
            .populate('host', 'nickname avatar') 
            .populate('participants', 'nickname avatar');

        if (!meeting) {
            return res.status(404).json({ message: '모임을 찾을 수 없습니다.' });
        }

        const similarMeetings = await Meeting.find({
            category: meeting.category,
            _id: { $ne: meetingId }
        })
        .limit(3)
        .populate('host', 'nickname');

        res.json({ ...meeting.toObject(), similarMeetings });

    } catch (error) {
        console.error(`Error fetching meeting ${req.params.id}:`, error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


/**
 * ------------------------------------------------------------------
 * POST / - 새로운 모임 생성 (호스트가 본인인 모임 추천 제외)
 * ------------------------------------------------------------------
 */
router.post('/', verifyToken, upload.single('meetingImage'), async (req, res) => {
    const { title, description, category, location, date, maxParticipants } = req.body; 
    const host = req.user.userId;
    
    // 업로드된 파일 경로 처리
    const coverImage = req.file ? `/uploads/${req.file.filename}` : undefined;

    try {
        // AI 서버에 유사 모임 검색 요청
        const agentResponse = await axios.post(`${AI_AGENT_URL}/agent/invoke`, {
            user_input: {
                title,
                description,
                time: new Date(date).toLocaleString('ko-KR'),
                location
            }
        });

        // 👇 --- [JSON 파싱 로직: 오류 방지 및 마크다운 처리] --- 👇
        const aiResponseText = agentResponse.data.final_answer;
        let recommendations;
        
        try {
            // 1. JSON 마크다운 태그 제거 및 공백 정리
            let jsonString = aiResponseText.replace(/```json\n|```/g, '').trim();
            // 2. JSON 파싱 시도 (여기서 오류 발생 가능성 높음)
            recommendations = JSON.parse(jsonString);
        } catch (e) {
            // 3. 파싱 실패 시, 콘솔에 오류 로그를 남기고 빈 추천 목록으로 대체하여 서버 다운 방지
            console.error("AI 응답 파싱 실패 (AI가 JSON 대신 일반 텍스트를 반환했습니다. 서버 다운 방지):", aiResponseText);
            // 빈 객체를 사용하여 추천이 없다고 간주하고 다음 로직으로 진행
            recommendations = { recommendations: [] }; 
        }
        // 👆 --- [JSON 파싱 로직] --- 👆

        if (recommendations && recommendations.recommendations && recommendations.recommendations.length > 0) {
            
            // 👇 --- (기존 AI 로직 유지) --- 👇
            const recommendedIds = recommendations.recommendations.map(rec => rec.meeting_id);
            const recommendedMeetingsFromDB = await Meeting.find({ '_id': { $in: recommendedIds } });

            const filteredRecs = recommendations.recommendations.filter(rec => {
                const meeting = recommendedMeetingsFromDB.find(m => m._id.toString() === rec.meeting_id);
                // DB에서 찾은 모임의 호스트 ID와 현재 사용자 ID가 다를 경우에만 포함
                return meeting && meeting.host.toString() !== host;
            });
            // ------------------------------------

            // 필터링 후에도 추천할 모임이 남아있다면
            if (filteredRecs.length > 0) {
                console.log('AI가 추천한 모임 (본인 모임 제외):', filteredRecs);
                
                // 임시로 업로드된 파일 경로를 프론트엔드에 전달하여 강제 생성 시 재사용하도록 유도
                return res.status(200).json({
                    action: 'recommend',
                    recommendations: { // 원본 구조 유지
                        summary: recommendations.summary,
                        recommendations: filteredRecs
                    },
                    newMeetingData: req.body,
                    tempCoverImage: coverImage // ❗ 임시 파일 경로 전달
                });
            }
        }
        
        console.log('AI가 유사 모임을 찾지 못했거나, 본인 모임만 추천되어 신규 모임을 생성합니다.');
        const newMeeting = new Meeting({
            title, description, coverImage, category, location, date, maxParticipants, host, // ❗ coverImage 사용
            participants: [host]
        });

        const savedMeeting = await newMeeting.save();
        
        // Pinecone에 모임 정보 추가 요청
        try {
            await axios.post(`${AI_AGENT_URL}/meetings/add`, {
                meeting_id: savedMeeting._id.toString(),
                title: savedMeeting.title,
                description: savedMeeting.description,
                time: new Date(savedMeeting.date).toLocaleString('ko-KR'),
                location: savedMeeting.location
            });
            console.log(`Pinecone에 모임(ID: ${savedMeeting._id}) 추가 요청 성공.`);
        } catch (aiError) {
            console.error("AI 서버(Pinecone)에 모임 추가 중 오류:", aiError.message);
        }
        
        res.status(201).json({
            action: 'created',
            meeting: savedMeeting
        });

    } catch (error) {
        console.error("모임 생성/추천 과정에서 에러 발생:", error);
        // 오류 발생 시 파일 정리 로직 추가 (필요하다면 fs 모듈을 사용하세요)
        // if (req.file) { fs.unlinkSync(req.file.path); }
        res.status(500).json({ message: '모임 생성 중 서버 오류가 발생했습니다.' });
    }
});


// "무시하고 생성" 요청을 처리하는 API
router.post('/force-create', verifyToken, upload.single('meetingImage'), async (req, res) => {
    try {
        console.log('AI 추천 무시하고 강제 생성을 요청받았습니다.');
        // 텍스트 필드와 임시 파일 경로를 가져옴
        const { title, description, category, location, date, maxParticipants, tempCoverImage } = req.body;
        const host = req.user.userId;
        
        // req.file이 있다면 새로 업로드된 파일을, 없다면 임시 파일 경로를 사용
        const finalCoverImage = req.file ? `/uploads/${req.file.filename}` : tempCoverImage;

        const newMeeting = new Meeting({
            title, description, coverImage: finalCoverImage, category, location, date, maxParticipants, host,
            participants: [host]
        });

        const savedMeeting = await newMeeting.save();

        try {
            await axios.post(`${AI_AGENT_URL}/meetings/add`, {
                meeting_id: savedMeeting._id.toString(),
                title: savedMeeting.title,
                description: savedMeeting.description,
                time: new Date(savedMeeting.date).toLocaleString('ko-KR'),
                location: savedMeeting.location
            });
            console.log(`Pinecone에 강제 생성된 모임(ID: ${savedMeeting._id}) 추가 요청 성공.`);
        } catch (aiError) {
            console.error("AI 서버(Pinecone)에 모임 추가 중 오류:", aiError.message);
        }

        res.status(201).json({ meeting: savedMeeting });

    } catch (error) {
        console.error("모임 강제 생성 에러:", error);
        // 오류 발생 시 파일 정리 로직 추가
        // if (req.file) { fs.unlinkSync(req.file.path); }
        res.status(400).json({ message: '모임 생성에 실패했습니다.', error: error.message });
    }
});

// 모임 삭제 API
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const meetingId = req.params.id;
        const meeting = await Meeting.findById(meetingId);

        if (!meeting) {
            return res.status(404).json({ message: '모임을 찾을 수 없습니다.' });
        }

        if (meeting.host.toString() !== req.user.userId) {
            return res.status(403).json({ message: '모임을 삭제할 권한이 없습니다.' });
        }
        
        // [추가] 실제 파일 삭제 로직은 포함하지 않았으나, 만약 필요하다면 fs 모듈을 사용하여 구현해야 합니다.
        // if (meeting.coverImage) { fs.unlinkSync(path.join(__dirname, '..', meeting.coverImage)); }

        try {
            console.log('AI 서버에 Pinecone 데이터 삭제를 요청합니다...');
            await axios.delete(`${AI_AGENT_URL}/meetings/delete/${meetingId}`);
            console.log(`Pinecone에 모임(ID: ${meetingId}) 삭제 요청 성공.`);
        } catch (aiError) {
            console.error("AI 서버(Pinecone)에서 모임 정보를 삭제하는 중 오류 발생:", aiError.message);
        }

        await Meeting.findByIdAndDelete(meetingId);
        
        res.json({ message: '모임이 성공적으로 삭제되었습니다.' });

    } catch (error) {
        console.error("모임 삭제 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 모임 참여 신청 API
router.post('/:id/join', verifyToken, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ message: '모임을 찾을 수 없습니다.' });
        }
        if (meeting.participants.length >= meeting.maxParticipants) {
            return res.status(400).json({ message: '모집 인원이 가득 찼습니다.' });
        }
        if (meeting.participants.includes(req.user.userId)) {
            return res.status(400).json({ message: '이미 참여하고 있는 모임입니다.' });
        }
        meeting.participants.push(req.user.userId);
        await meeting.save();
        
        const updatedMeeting = await Meeting.findById(req.params.id)
            .populate('host', 'nickname')
            .populate('participants', 'nickname');

        res.json({ message: '모임 참여 신청이 완료되었습니다.', meeting: updatedMeeting });
    } catch (error) {
        console.error("모임 참여 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 모임 참여 취소 API
router.post('/:id/leave', verifyToken, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ message: '모임을 찾을 수 없습니다.' });
        }
        if (meeting.host.toString() === req.user.userId) {
            return res.status(400).json({ message: '호스트는 모임을 떠날 수 없습니다. 모임을 삭제해주세요.' });
        }
        const participantIndex = meeting.participants.indexOf(req.user.userId);
        if (participantIndex === -1) {
            return res.status(400).json({ message: '참여하고 있는 모임이 아닙니다.' });
        }
        meeting.participants.splice(participantIndex, 1);
        await meeting.save();
        
        const updatedMeeting = await Meeting.findById(req.params.id)
            .populate('host', 'nickname')
            .populate('participants', 'nickname');
            
        res.json({ message: '모임 참여가 취소되었습니다.', meeting: updatedMeeting });
    } catch (error) {
        console.error("모임 나가기 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/**
 * ---------------------------------
 * POST /api/meetings/ai-search - AI 스마트 검색 (AI 연결 코드 추가됨)
 * ---------------------------------
 */
router.post('/ai-search', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ message: '검색어를 입력해주세요.' });
        }

        console.log(`AI 서버로 스마트 검색 요청: "${query}"`);

        // [핵심] AI 서버의 '모임 매칭 에이전트'를 재사용합니다.
        // 'title'에 검색어를 넣어서 보내면, AI는 이를 '새 모임 제목'으로 인식하고
        // 그와 유사한 기존 모임들을 찾아서 추천해줍니다. (이게 바로 스마트 검색!)
        const agentResponse = await axios.post(`${AI_AGENT_URL}/agent/invoke`, {
            user_input: {
                title: query, // 검색어를 제목처럼 전달하여 유사도 검색 유도
                description: "스마트 검색 요청입니다.", 
                time: "",
                location: ""
            }
        });

        // AI 응답 파싱 (AI는 JSON 문자열로 응답함)
        const aiResult = agentResponse.data.final_answer;
        
        // 혹시 모를 에러 처리 (AI가 빈 문자열 등을 줄 경우)
        if (!aiResult) {
             return res.json({ summary: "검색 결과가 없습니다.", results: [] });
        }

        let parsedResult;
        try {
             // JSON 마크다운 태그 제거 후 파싱
             parsedResult = JSON.parse(aiResult.replace(/```json\n|\n```/g, '').trim());
        } catch (e) {
             // AI가 JSON이 아닌 평문을 반환했을 경우
             console.error("AI 검색 결과 파싱 실패:", e);
             return res.json({ summary: aiResult, results: [] });
        }
        
        // AI가 추천한 모임 ID들만 추출
        const recommendedIds = parsedResult.recommendations ? parsedResult.recommendations.map(rec => rec.meeting_id) : [];
        
        // DB에서 해당 ID를 가진 모임들의 전체 정보를 가져옴
        const meetings = await Meeting.find({ '_id': { $in: recommendedIds } })
            .populate('host', 'nickname')
            .populate('participants');

        // AI 추천 순서대로 정렬 (정확도 순)
        const sortedMeetings = recommendedIds
            .map(id => meetings.find(m => m._id.toString() === id))
            .filter(m => m !== undefined); // 혹시 DB에 없는 경우 제외

        res.json({
            summary: parsedResult.summary, // "이런 모임들은 어떠신가요?" 같은 멘트
            results: sortedMeetings
        });

    } catch (error) {
        console.error("AI 스마트 검색 에러:", error.message);
        if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
            return res.status(500).json({ message: "AI 서버가 실행 중이지 않습니다. (8000번 포트 확인)" });
        }
        res.status(200).json({ summary: "검색 중 오류가 발생했습니다.", results: [] });
    }
});

module.exports = router;