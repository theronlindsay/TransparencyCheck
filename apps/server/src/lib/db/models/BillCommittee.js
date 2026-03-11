import mongoose from '../mongoose.js';

const billCommitteeSchema = new mongoose.Schema({
	billId: { type: String, required: true },
	committeeCode: { type: String, required: true }
});

billCommitteeSchema.index({ billId: 1, committeeCode: 1 }, { unique: true });

export default mongoose.models.BillCommittee ?? mongoose.model('BillCommittee', billCommitteeSchema);
