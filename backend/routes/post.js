const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { verifyToken } = require('../utils/auth');
const upload = require('../middleware/upload');

// 게시글 작성 (이미지 포함 가능)
router.post('/', verifyToken, upload.array('images', 5), async (req, res) => {
    try {
        const { title, content } = req.body;
        const files = req.files;

        const lastPost = await Post.findOne().sort({ number: -1 });
        const nextNumber = lastPost ? lastPost.number + 1 : 1;

        const fileUrls = files ? files.map(file => `/uploads/${file.filename}`) : [];

        const newPost = new Post({ number: nextNumber, title, content, fileUrl: fileUrls, author: req.user.userId });
        await newPost.save();

        res.status(201).json({ message: '게시글이 작성되었습니다.', post: newPost });
    } catch (error) {
        console.error("게시글 작성 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 게시글 목록 조회 (페이지네이션)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
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

// 특정 게시글 조회
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });

        post.views += 1;
        await post.save();

        res.json(post);
    } catch (error) {
        console.error("게시글 조회 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 게시글 수정
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });

        const isOwner = post.author && post.author.toString() === req.user.userId;
        const isAdmin = req.user.role === 1;
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: '게시글을 수정할 권한이 없습니다.' });
        }

        post.title = title;
        post.content = content;
        post.updatedAt = Date.now();
        await post.save();

        res.json({ message: '게시글이 수정되었습니다.', post });
    } catch (error) {
        console.error("게시글 수정 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 게시글 삭제
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });

        const isOwner = post.author && post.author.toString() === req.user.userId;
        const isAdmin = req.user.role === 1;
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: '게시글을 삭제할 권한이 없습니다.' });
        }

        await post.deleteOne();
        res.json({ message: '게시글이 삭제되었습니다.' });
    } catch (error) {
        console.error("게시글 삭제 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
