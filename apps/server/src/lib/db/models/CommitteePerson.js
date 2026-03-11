import mongoose from '../mongoose.js';

const committeePersonSchema = new mongoose.Schema({
	committeeCode: { type: String, required: true },
	personId: { type: String, required: true },
	role: String
});

committeePersonSchema.index({ committeeCode: 1, personId: 1 }, { unique: true });

export default mongoose.models.CommitteePerson ?? mongoose.model('CommitteePerson', committeePersonSchema);
