const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { verifyToken } = require('../utils/auth');
const multer = require('multer');
const path = require('path');

// --- Multer 설정 (이미지 업로드용) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // 파일이 저장될 경로
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // 파일명 중복 방지
    }
});

const upload = multer({ storage: storage });

// 1. 게시글 작성 (이미지 포함 가능)
router.post('/', verifyToken, upload.array('images', 5), async (req, res) => {
    try {
        const { title, content } = req.body;
        const files = req.files; // 업로드된 파일 정보

        // 가장 마지막 게시글 번호 찾기 (number 필드 자동 증가)
        const lastPost = await Post.findOne().sort({ number: -1 });
        const nextNumber = lastPost ? lastPost.number + 1 : 1;

        // 파일 URL 생성 (서버 주소 + 파일명)
        const fileUrls = files ? files.map(file => `/uploads/${file.filename}`) : [];

        const newPost = new Post({
            number: nextNumber,
            title,
            content,
            fileUrl: fileUrls,
            // 작성자 정보는 필요하다면 req.user.userId로 추가 (모델 수정 필요)
        });

        await newPost.save();
        res.status(201).json({ message: '게시글이 작성되었습니다.', post: newPost });
    } catch (error) {
        console.error("게시글 작성 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 2. 게시글 목록 조회 (페이지네이션 포함)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find()
            .sort({ createdAt: -1 }) // 최신순 정렬
            .skip(skip)
            .limit(limit);

        const totalPosts = await Post.countDocuments();

        res.json({
            posts,
            currentPage: page,
            totalPages: Math.ceil(totalPosts / limit),
            totalPosts
        });
    } catch (error) {
        console.error("게시글 목록 조회 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 3. 특정 게시글 조회
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        // 조회수 증가
        post.views += 1;
        await post.save();

        res.json(post);
    } catch (error) {
        console.error("게시글 조회 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 4. 게시글 수정
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { title, content, updatedAt: Date.now() },
            { new: true } // 업데이트된 문서 반환
        );

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        res.json({ message: '게시글이 수정되었습니다.', post });
    } catch (error) {
        console.error("게시글 수정 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 5. 게시글 삭제
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const post = await Post.findByIdAndDelete(req.params.id);
        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }
        res.json({ message: '게시글이 삭제되었습니다.' });
    } catch (error) {
        console.error("게시글 삭제 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;