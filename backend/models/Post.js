const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: true,
      unique: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: [String],
      default: [],
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 관리
  }
);

const Post = mongoose.model("Post", postSchema);

module.exports = Post;