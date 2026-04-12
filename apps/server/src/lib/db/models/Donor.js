import mongoose from 'mongoose';

const donorSchema = new mongoose.Schema({
    politicianId: {
        type: String,
        required: true,
        index: true
    },
    donorName: {
        type: String, // Individual name or PAC name
        required: true
    },
    donorType: {
        type: String, // 'Individual' | 'PAC'
        default: 'Individual'
    },
    amount: {
        type: Number,
        required: true
    },
    electionCycle: {
        type: String // e.g. '2026'
    },
    date: {
        type: Date
    },
    source: {
        type: String,
        default: 'OpenFEC API'
    }
}, { timestamps: true });

// Compound index for quick aggregation
donorSchema.index({ politicianId: 1, electionCycle: 1, amount: -1 });

export const Donor = mongoose.models.Donor || mongoose.model('Donor', donorSchema);
