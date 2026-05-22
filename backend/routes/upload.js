const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { verifyToken } = require('../utils/auth');

// 1. 로컬 저장소 설정 (개발 환경용)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 2. 이미지 업로드 API (단일 파일)
router.post('/', verifyToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
        }
        // 업로드된 파일의 접근 URL 반환
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ url: fileUrl });
    } catch (error) {
        console.error("이미지 업로드 에러:", error);
        res.status(500).json({ message: '이미지 업로드 중 오류가 발생했습니다.' });
    }
});

// 3. 다중 이미지 업로드 API (필요시 사용)
router.post('/multiple', verifyToken, upload.array('files', 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
        }
        const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
        res.json({ urls: fileUrls });
    } catch (error) {
        console.error("다중 이미지 업로드 에러:", error);
        res.status(500).json({ message: '이미지 업로드 중 오류가 발생했습니다.' });
    }
});

module.exports = router;