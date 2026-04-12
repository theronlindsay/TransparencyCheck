import mongoose from 'mongoose';

const savedBillSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    billId: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'Tracking'
    },
    savedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export const SavedBill = mongoose.models.SavedBill || mongoose.model('SavedBill', savedBillSchema);
