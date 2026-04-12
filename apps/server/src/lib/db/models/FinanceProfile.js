import mongoose from 'mongoose';

// Defines the Finance Profile natively to aggregate totals and an array of individual donations natively
const financeProfileSchema = new mongoose.Schema({
    politicianId: {
        type: String, // bioguideId
        required: true,
        index: true,
        unique: true
    },
    totals: {
        receipts: { type: Number, default: 0 },
        disbursements: { type: Number, default: 0 },
        cash_on_hand: { type: Number, default: 0 }
    },
    donors: [{
        donorName: String,
        amount: Number,
        date: String
    }],
    lastSyncedAt: {
        type: Date,
        default: Date.now
    },
    /** Bump when donor fetch strategy changes (triggers one-time refetch). */
    donorAggVersion: {
        type: Number,
        default: 0
    },
    /** FEC candidate_id used for this cached snapshot (OpenFEC). */
    fecCandidateId: {
        type: String,
        default: null
    }
}, { timestamps: true });

export const FinanceProfile = mongoose.models.FinanceProfile || mongoose.model('FinanceProfile', financeProfileSchema);
