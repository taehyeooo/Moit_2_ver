const mongoose = require("mongoose");

const contactSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 50,
  },
  email: {
    type: String,
    trim: true,
    required: true,
  },
  phone: {
    type: String,
    maxlength: 20,
  },
  message: {
    type: String,
    required: true,
    minlength: 1,
  },
  status: {
    type: String,
    default: '대기중', 
  },
  // 👇 [추가] 답변 내용과 답변 날짜 필드
  reply: {
    type: String,
    default: null
  },
  repliedAt: {
    type: Date,
    default: null,
    index: true // Q&A 목록 repliedAt 정렬 최적화
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

contactSchema.index({ status: 1, repliedAt: -1 }); // 완료 필터 + 정렬 복합 인덱스

const Contact = mongoose.model("Contact", contactSchema);

module.exports = { Contact };