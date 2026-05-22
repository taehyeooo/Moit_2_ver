const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/auth');
const upload = require('../middleware/upload');

// 단일 파일 업로드
router.post('/', verifyToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
        res.json({ url: `/uploads/${req.file.filename}` });
    } catch (error) {
        console.error("이미지 업로드 에러:", error);
        res.status(500).json({ message: '이미지 업로드 중 오류가 발생했습니다.' });
    }
});

// 다중 파일 업로드
router.post('/multiple', verifyToken, upload.array('files', 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
        }
        res.json({ urls: req.files.map(file => `/uploads/${file.filename}`) });
    } catch (error) {
        console.error("다중 이미지 업로드 에러:", error);
        res.status(500).json({ message: '이미지 업로드 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
