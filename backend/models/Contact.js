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
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const Contact = mongoose.model("Contact", contactSchema);

module.exports = { Contact };