const express = require('express');
const router = express.Router();
const { Contact } = require('../models/Contact');

// 문의 제출 API
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;
        const contact = new Contact({
            name, email, phone, message, status: '대기중'
        });
        await contact.save();
        res.status(200).json({ success: true, message: '문의사항이 성공적으로 접수되었습니다.' });
    } catch (err) {
        console.error("Contact Save Error:", err);
        res.status(400).json({ success: false, message: '문의 접수 중 오류가 발생했습니다.', error: err });
    }
});

// 👇 [수정] Q&A 목록 조회 API (조건 완화)
router.get('/qna', async (req, res) => {
    try {
        // reply 필드가 존재하고(exists), 빈 문자열이 아닌($ne: "") 문서만 조회
        const qnaList = await Contact.find({
            reply: { $exists: true, $ne: "" },
            status: '완료' // 확실하게 완료된 것만
        }).sort({ repliedAt: -1 });
        
        res.status(200).json(qnaList);
    } catch (err) {
        console.error("QnA List Error:", err);
        res.status(500).json({ message: 'Q&A 목록을 불러오는데 실패했습니다.' });
    }
}); 

module.exports = router;