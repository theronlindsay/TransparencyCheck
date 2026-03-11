import mongoose from '../mongoose.js';

const committeeSchema = new mongoose.Schema(
	{
		_id: { type: String }, // committeeCode
		name: String,
		chamber: String,
		type: String,
		subcommitteeCode: String,
		parentCommitteeCode: String,
		url: String
	},
	{ _id: false }
);

export default mongoose.models.Committee ?? mongoose.model('Committee', committeeSchema);
