const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // 👈 bcryptjs로 변경
const jwt = require("jsonwebtoken");

const userSchema = mongoose.Schema({
    username: { type: String, unique: 1 }, // username 필드 명시
    name: { type: String, maxlength: 50 },
    email: { type: String, trim: true, unique: 1 },
    password: { type: String, minlength: 5 },
    nickname: { type: String, maxlength: 50 }, // nickname 필드 추가
    lastname: { type: String, maxlength: 50 },
    role: { type: Number, default: 0 },
    image: String,
    token: { type: String },
    tokenExp: { type: Number },
    isActive: { type: Boolean, default: true }, // 로그인 체크용
    isLoggedIn: { type: Boolean, default: false },
    ipAddress: { type: String },
    surveyResult: { type: mongoose.Schema.Types.ObjectId, ref: 'SurveyResult', default: null },
    surveyProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    hobbyRecommendation: { type: mongoose.Schema.Types.Mixed, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lastLoginAttempt: { type: Date, default: null }
});

// 비밀번호 암호화 (회원가입 시 자동 실행)
userSchema.pre("save", function (next) {
    var user = this;

    // 비밀번호가 변경되었을 때만 암호화
    if (user.isModified("password")) {
        bcrypt.genSalt(10, function (err, salt) {
            if (err) return next(err);
            bcrypt.hash(user.password, salt, function (err, hash) {
                if (err) return next(err);
                user.password = hash;
                next();
            });
        });
    } else {
        next();
    }
});

userSchema.methods.comparePassword = function (plainPassword, cb) {
    bcrypt.compare(plainPassword, this.password, function (err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

// 토큰 생성 메소드
userSchema.methods.generateToken = function (cb) {
    var user = this;
    var token = jwt.sign(user._id.toHexString(), process.env.JWT_SECRET);
    user.token = token;
    user.save()
        .then(() => cb(null, user))
        .catch((err) => cb(err));
};

userSchema.statics.findByToken = function (token, cb) {
    var user = this;
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        user.findOne({ "_id": decoded, "token": token })
            .then((user) => cb(null, user))
            .catch((err) => cb(err));
    });
};

const User = mongoose.model("User", userSchema);

module.exports = User; // 👈 { User } 가 아니라 User로 내보내는 경우가 많으므로 확인 필요 (위 router에서는 require('../models/User')로 씀)