import mongoose from 'mongoose';

const stockTradeSchema = new mongoose.Schema({
    politicianId: {
        type: String,
        required: true,
        index: true
    },
    ticker: {
        type: String,
        required: true
    },
    companyName: {
        type: String
    },
    transactionDate: {
        type: Date,
        required: true
    },
    disclosureDate: {
        type: Date
    },
    transactionType: {
        type: String, // 'Purchase' | 'Sale'
        required: true
    },
    amountRange: {
        type: String // e.g. '$1,001 - $15,000'
    },
    source: {
        type: String // e.g. 'Senate Disclosure', 'Quiver Quantitative'
    }
}, { timestamps: true });

export const StockTrade = mongoose.models.StockTrade || mongoose.model('StockTrade', stockTradeSchema);
