import mongoose from '../mongoose.js';

const billActionSchema = new mongoose.Schema({
	billId: { type: String, required: true, index: true },
	actionDate: String,
	text: String,
	type: String,
	actionCode: String,
	sourceSystem: mongoose.Schema.Types.Mixed
});

billActionSchema.index({ billId: 1, actionDate: -1 });
billActionSchema.index({ billId: 1, actionDate: 1, text: 1, actionCode: 1 }, { unique: true, sparse: true });

export default mongoose.models.BillAction ?? mongoose.model('BillAction', billActionSchema);
