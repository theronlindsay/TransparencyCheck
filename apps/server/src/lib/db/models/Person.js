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
		imageUrl: String,
		sponsoredBills: [{
			number: String,
			displayTitle: String,
			introducedDate: String,
			congress: Number
		}],
		fec_candidate_id: String,
		url: String
	},
	{ _id: false }
);

export default mongoose.models.Person ?? mongoose.model('Person', personSchema);
