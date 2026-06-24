const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema({
    username: { type: String, unique: true },
    name: { type: String, maxlength: 50 },
    email: { type: String, trim: true, unique: true },
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

// 비밀번호 암호화 (회원가입·비밀번호 변경 시 자동 실행)
userSchema.pre("save", async function () {
    if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

const User = mongoose.model("User", userSchema);

module.exports = User; // 👈 { User } 가 아니라 User로 내보내는 경우가 많으므로 확인 필요 (위 router에서는 require('../models/User')로 씀)