const express = require('express');
const router = express.Router();
const axios = require('axios');
const Meeting = require('../models/Meeting');
const { verifyToken } = require('../utils/auth');
const { isMockMode } = require('../utils/mockAI');
const upload = require('../middleware/upload');

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

// 마감 임박 모임 조회
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

// 특정 모임 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const meetingId = req.params.id;
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
        }).limit(3).populate('host', 'nickname');

        res.json({ ...meeting.toObject(), similarMeetings });
    } catch (error) {
        console.error(`Error fetching meeting ${req.params.id}:`, error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 새로운 모임 생성
router.post('/', verifyToken, upload.single('meetingImage'), async (req, res) => {
    const { title, description, category, location, date, maxParticipants } = req.body;
    const host = req.user.userId;
    const coverImage = req.file ? `/uploads/${req.file.filename}` : undefined;

    try {
        // 목 모드: AI 호출 없이 바로 생성
        if (isMockMode()) {
            console.log("[MOCK] AI 호출 없이 모임 바로 생성");
            const newMeeting = new Meeting({
                title, description, coverImage, category, location, date, maxParticipants,
                host, participants: [host]
            });
            const savedMeeting = await newMeeting.save();
            return res.status(201).json({ action: 'created', meeting: savedMeeting });
        }

        // AI 서버에 유사 모임 검색 요청
        const agentResponse = await axios.post(`${AI_AGENT_URL}/agent/invoke`, {
            user_input: {
                title, description,
                time: new Date(date).toLocaleString('ko-KR'),
                location
            }
        });

        const aiResponseText = agentResponse.data.final_answer;
        let recommendations;

        try {
            let jsonString = aiResponseText.replace(/```json\n|```/g, '').trim();
            recommendations = JSON.parse(jsonString);
        } catch (e) {
            console.error("AI 응답 파싱 실패:", aiResponseText);
            recommendations = { recommendations: [] };
        }

        if (recommendations?.recommendations?.length > 0) {
            const recommendedIds = recommendations.recommendations.map(rec => rec.meeting_id);
            const recommendedMeetingsFromDB = await Meeting.find({ '_id': { $in: recommendedIds } });

            const filteredRecs = recommendations.recommendations.filter(rec => {
                const meeting = recommendedMeetingsFromDB.find(m => m._id.toString() === rec.meeting_id);
                return meeting && meeting.host.toString() !== host;
            });

            if (filteredRecs.length > 0) {
                return res.status(200).json({
                    action: 'recommend',
                    recommendations: { summary: recommendations.summary, recommendations: filteredRecs },
                    newMeetingData: req.body,
                    tempCoverImage: coverImage
                });
            }
        }

        const newMeeting = new Meeting({
            title, description, coverImage, category, location, date, maxParticipants,
            host, participants: [host]
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
        } catch (aiError) {
            console.error("Pinecone 모임 추가 오류:", aiError.message);
        }

        res.status(201).json({ action: 'created', meeting: savedMeeting });

    } catch (error) {
        console.error("모임 생성 에러:", error);
        res.status(500).json({ message: '모임 생성 중 서버 오류가 발생했습니다.' });
    }
});

// AI 추천 무시하고 강제 생성
router.post('/force-create', verifyToken, upload.single('meetingImage'), async (req, res) => {
    try {
        const { title, description, category, location, date, maxParticipants, tempCoverImage } = req.body;
        const host = req.user.userId;
        const finalCoverImage = req.file ? `/uploads/${req.file.filename}` : tempCoverImage;

        const newMeeting = new Meeting({
            title, description, coverImage: finalCoverImage, category, location, date, maxParticipants,
            host, participants: [host]
        });
        const savedMeeting = await newMeeting.save();

        if (!isMockMode()) {
            try {
                await axios.post(`${AI_AGENT_URL}/meetings/add`, {
                    meeting_id: savedMeeting._id.toString(),
                    title: savedMeeting.title,
                    description: savedMeeting.description,
                    time: new Date(savedMeeting.date).toLocaleString('ko-KR'),
                    location: savedMeeting.location
                });
            } catch (aiError) {
                console.error("Pinecone 모임 추가 오류:", aiError.message);
            }
        }

        res.status(201).json({ meeting: savedMeeting });
    } catch (error) {
        console.error("모임 강제 생성 에러:", error);
        res.status(400).json({ message: '모임 생성에 실패했습니다.', error: error.message });
    }
});

// 모임 삭제
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const meetingId = req.params.id;
        const meeting = await Meeting.findById(meetingId);

        if (!meeting) return res.status(404).json({ message: '모임을 찾을 수 없습니다.' });
        if (meeting.host.toString() !== req.user.userId) {
            return res.status(403).json({ message: '모임을 삭제할 권한이 없습니다.' });
        }

        if (!isMockMode()) {
            try {
                await axios.delete(`${AI_AGENT_URL}/meetings/delete/${meetingId}`);
            } catch (aiError) {
                console.error("Pinecone 모임 삭제 오류:", aiError.message);
            }
        }

        await Meeting.findByIdAndDelete(meetingId);
        res.json({ message: '모임이 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error("모임 삭제 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 모임 참여
router.post('/:id/join', verifyToken, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) return res.status(404).json({ message: '모임을 찾을 수 없습니다.' });
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

// 모임 탈퇴
router.post('/:id/leave', verifyToken, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) return res.status(404).json({ message: '모임을 찾을 수 없습니다.' });
        if (meeting.host.toString() === req.user.userId) {
            return res.status(400).json({ message: '호스트는 모임을 떠날 수 없습니다. 모임을 삭제해주세요.' });
        }

        const idx = meeting.participants.indexOf(req.user.userId);
        if (idx === -1) return res.status(400).json({ message: '참여하고 있는 모임이 아닙니다.' });

        meeting.participants.splice(idx, 1);
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

// AI 스마트 검색 (목 모드 시 MongoDB 텍스트 검색으로 대체)
router.post('/ai-search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ message: '검색어를 입력해주세요.' });

        // 목 모드: MongoDB 정규식 검색
        if (isMockMode()) {
            console.log(`[MOCK] 텍스트 검색: "${query}"`);
            const regex = new RegExp(query, 'i');
            const meetings = await Meeting.find({
                $or: [
                    { title: regex },
                    { description: regex },
                    { category: regex },
                    { location: regex }
                ]
            })
            .populate('host', 'nickname')
            .populate('participants')
            .sort({ createdAt: -1 })
            .limit(10);

            return res.json({
                summary: `"${query}" 관련 모임 ${meetings.length}개를 찾았습니다.`,
                results: meetings
            });
        }

        const agentResponse = await axios.post(`${AI_AGENT_URL}/agent/invoke`, {
            user_input: {
                title: query,
                description: "스마트 검색 요청입니다.",
                time: "", location: ""
            }
        });

        const aiResult = agentResponse.data.final_answer;
        if (!aiResult) return res.json({ summary: "검색 결과가 없습니다.", results: [] });

        let parsedResult;
        try {
            parsedResult = JSON.parse(aiResult.replace(/```json\n|\n```/g, '').trim());
        } catch (e) {
            return res.json({ summary: aiResult, results: [] });
        }

        const recommendedIds = parsedResult.recommendations
            ? parsedResult.recommendations.map(rec => rec.meeting_id)
            : [];

        const meetings = await Meeting.find({ '_id': { $in: recommendedIds } })
            .populate('host', 'nickname')
            .populate('participants');

        const sortedMeetings = recommendedIds
            .map(id => meetings.find(m => m._id.toString() === id))
            .filter(Boolean);

        res.json({ summary: parsedResult.summary, results: sortedMeetings });

    } catch (error) {
        console.error("AI 스마트 검색 에러:", error.message);
        res.status(500).json({ message: "검색 중 오류가 발생했습니다." });
    }
});

module.exports = router;
