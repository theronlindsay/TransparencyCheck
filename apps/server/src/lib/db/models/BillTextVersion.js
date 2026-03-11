import mongoose from '../mongoose.js';

const billTextVersionSchema = new mongoose.Schema({
	billId: { type: String, required: true, index: true },
	type: String,
	date: String,
	formatType: String,
	url: String,
	content: String,
	contentFetched: { type: Number, default: 0 }
});

billTextVersionSchema.index({ billId: 1, type: 1, formatType: 1 }, { unique: true, sparse: true });

export default mongoose.models.BillTextVersion ?? mongoose.model('BillTextVersion', billTextVersionSchema);
