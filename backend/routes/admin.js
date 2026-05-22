const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post'); // Post 모델 가져오기
// 👇 [핵심] Contact 모델은 객체로 export 되므로 중괄호 {}로 감싸서 가져와야 합니다.
const { Contact } = require('../models/Contact'); 
const Meeting = require('../models/Meeting');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");

// --- 관리자 인증 미들웨어 ---
const verifyAdmin = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    // role이 1이면 관리자라고 가정
    if (!user || user.role !== 1) {
      return res.status(403).json({ message: '관리자 권한이 없습니다.' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
};

// 1. 관리자 로그인
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username }).select('+password');

        if (!user) {
            return res.status(401).json({ message: '존재하지 않는 아이디입니다.' });
        }
        
        if (user.role !== 1) {
             return res.status(403).json({ message: '관리자 계정이 아닙니다.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        }).status(200).json({ 
            loginSuccess: true, 
            user: userWithoutPassword 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 2. 관리자 인증 확인
router.get('/auth', verifyAdmin, (req, res) => {
    res.status(200).json({
        isAdmin: true,
        isAuth: true,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
    });
});

// 3. 전체 사용자 목록 조회
router.get('/users', verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: '사용자 목록 조회 실패' });
    }
});

// 3-1. 사용자 강제 삭제
router.delete('/users/:id', verifyAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: '사용자가 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '사용자 삭제 실패' });
    }
});

// 4. 전체 게시글 목록 조회
router.get('/posts', verifyAdmin, async (req, res) => {
    try {
        const posts = await Post.find({}).sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: '게시글 목록 조회 실패' });
    }
});

// 5. 문의사항 목록 조회
router.get('/contacts', verifyAdmin, async (req, res) => {
    try {
        const contacts = await Contact.find({}).sort({ createdAt: -1 });
        res.json(contacts);
    } catch (error) {
        console.error("Contact Fetch Error:", error);
        res.status(500).json({ message: '문의사항 목록 조회 실패' });
    }
});

// 5-1. 문의사항 상태 변경
router.put('/contacts/:id', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        await Contact.findByIdAndUpdate(req.params.id, { status });
        res.json({ message: '상태가 변경되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '상태 변경 실패' });
    }
});

// 5-2. 문의사항 삭제
router.delete('/contacts/:id', verifyAdmin, async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.json({ message: '문의사항이 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '문의사항 삭제 실패' });
    }
});

// 👇 [수정] 5-3. 문의사항 답변 등록 (답변 시 상태 '완료' + 게시글 자동 생성)
router.put('/contacts/:id/reply', verifyAdmin, async (req, res) => {
    try {
        const { reply } = req.body;
        
        // 1. 문의 내역 업데이트 (답변 저장, 상태 완료)
        const contact = await Contact.findByIdAndUpdate(req.params.id, {
            reply: reply,
            status: '완료',
            repliedAt: Date.now()
        }, { new: true }); // 업데이트된 문서 반환

        if (!contact) {
            return res.status(404).json({ message: '문의글을 찾을 수 없습니다.' });
        }

        // 2. [핵심] 답변 내용을 바탕으로 새로운 게시글(Post) 자동 생성
        // 제목은 문의자의 이름이나 내용을 요약해서 만들고, 내용은 Q&A 형식으로 저장합니다.
        const lastPost = await Post.findOne().sort({ number: -1 });
        const nextNumber = lastPost ? lastPost.number + 1 : 1;

        // HTML 줄바꿈 처리
        const formattedMessage = contact.message.replace(/\n/g, '<br>');
        const formattedReply = reply.replace(/\n/g, '<br>');

        const newPost = new Post({
            number: nextNumber,
            title: `[Q&A] ${contact.name}님의 문의에 대한 답변입니다.`, // 제목 자동 생성
            content: `
                <div style="padding: 10px; background-color: #f9f9f9; border-radius: 8px;">
                    <p><strong>Q. 문의 내용</strong></p>
                    <p>${formattedMessage}</p>
                </div>
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
                <div style="padding: 10px;">
                    <p><strong>A. 답변</strong></p>
                    <p style="color: #2563eb;">${formattedReply}</p>
                </div>
            `, // HTML 형식으로 저장 (에디터 호환)
            fileUrl: [], // 첨부파일 없음
        });

        await newPost.save();

        res.json({ message: '답변이 등록되고 게시글로 발행되었습니다.' });
    } catch (error) {
        console.error("Reply Error:", error);
        res.status(500).json({ message: '답변 등록 실패' });
    }
});

// 6. 대시보드 통계 데이터 조회
router.get('/dashboard-stats', verifyAdmin, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const postCount = await Post.countDocuments();
        const contactCount = await Contact.countDocuments();
        const meetingCount = await Meeting.countDocuments();
        
        res.json({
            userCount,
            postCount,
            contactCount,
            meetingCount
        });
    } catch (error) {
        res.status(500).json({ message: '통계 데이터 조회 실패' });
    }
});

// 7. 전체 모임 목록 조회
router.get('/meetings', verifyAdmin, async (req, res) => {
    try {
        const meetings = await Meeting.find({})
            .populate('host', 'username nickname')
            .sort({ createdAt: -1 });
        res.json(meetings);
    } catch (error) {
        res.status(500).json({ message: '모임 목록 조회 실패' });
    }
});

// 7-1. 모임 강제 삭제
router.delete('/meetings/:id', verifyAdmin, async (req, res) => {
    try {
        await Meeting.findByIdAndDelete(req.params.id);
        res.json({ message: '모임이 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '모임 삭제 실패' });
    }
});

module.exports = router;