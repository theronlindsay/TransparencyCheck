import mongoose from '../mongoose.js';

const billPersonSchema = new mongoose.Schema({
	billId: { type: String, required: true },
	personId: { type: String, required: true },
	relationship: String,
	isByRequest: String
});

billPersonSchema.index({ billId: 1, personId: 1, relationship: 1 }, { unique: true });

export default mongoose.models.BillPerson ?? mongoose.model('BillPerson', billPersonSchema);
