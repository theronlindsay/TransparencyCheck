import mongoose from '../mongoose.js';

const personSchema = new mongoose.Schema(
	{
		_id: { type: String }, // bioguideId
		firstName: String,
		lastName: String,
		fullName: String,
		branch: String,
		party: String,
		state: String,
		district: String,
		donors: mongoose.Schema.Types.Mixed,
		url: String
	},
	{ _id: false }
);

export default mongoose.models.Person ?? mongoose.model('Person', personSchema);
