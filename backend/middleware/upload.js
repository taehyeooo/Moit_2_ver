const multer = require('multer');
const path = require('path');

const ALLOWED_TYPES = /jpeg|jpg|png|gif|webp/;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const extOk = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = ALLOWED_TYPES.test(file.mimetype);
    if (extOk && mimeOk) {
        cb(null, true);
    } else {
        cb(new Error('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)'));
    }
};

const upload = multer({ storage, limits: { fileSize: MAX_SIZE }, fileFilter });

module.exports = upload;
