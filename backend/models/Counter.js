const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // 카운터 이름 (예: 'post')
    seq: { type: Number, default: 0 }
});

counterSchema.statics.nextSeq = async function (name) {
    const result = await this.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return result.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
