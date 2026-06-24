const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: '인증이 필요합니다. 로그인해주세요.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
};

// 토큰에 role이 포함되어 있으므로 DB 조회 없이 권한 확인 (매 요청 DB 왕복 제거)
const verifyAdmin = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: '인증이 필요합니다.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 1) {
            return res.status(403).json({ message: '관리자 권한이 없습니다.' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
};

module.exports = { verifyToken, verifyAdmin };