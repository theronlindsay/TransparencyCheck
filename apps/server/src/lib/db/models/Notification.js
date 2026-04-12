import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    link: {
        type: String, // E.g., link to the bill that was updated
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
