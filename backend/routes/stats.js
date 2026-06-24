const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const User = require('../models/User');

router.get('/', async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // 세 쿼리가 독립적이므로 Promise.all로 병렬 실행
        const [totalMeetings, popularCategoryAgg, newUsersThisWeek] = await Promise.all([
            Meeting.countDocuments(),
            Meeting.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ]),
            User.countDocuments({ createdAt: { $gte: oneWeekAgo } })
        ]);

        const popularCategory = popularCategoryAgg.length > 0 ? popularCategoryAgg[0]._id : '아직 없어요';

        res.json({
            totalMeetings,
            popularCategory,
            newUsersThisWeek
        });

    } catch (error) {
        console.error("통계 데이터 조회 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;