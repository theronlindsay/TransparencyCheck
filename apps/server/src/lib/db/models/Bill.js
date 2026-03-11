import mongoose from '../mongoose.js';

const billSchema = new mongoose.Schema(
	{
		_id: { type: String }, // e.g. "hr123"
		billNumber: { type: String, required: true },
		congress: { type: Number, required: true },
		type: String,
		introducedDate: String,
		latestAction: mongoose.Schema.Types.Mixed,
		status: String,
		originChamber: String,
		originChamberCode: String,
		title: String,
		updateDate: String,
		updateDateIncludingText: String,
		legislationUrl: String,
		policyArea: mongoose.Schema.Types.Mixed,
		actionsCount: Number,
		actionsUrl: String,
		committeesCount: Number,
		committeesUrl: String,
		cosponsorsCount: Number,
		cosponsorsUrl: String,
		relatedBillsCount: Number,
		relatedBillsUrl: String,
		sponsors: [mongoose.Schema.Types.Mixed],
		primaryCommitteeName: String,
		subjectsCount: Number,
		subjectsUrl: String,
		summariesCount: Number,
		summaraiesUrl: String,
		textVersionsCount: Number,
		textVersionsUrl: String,
		titlesCount: Number,
		titlesUrl: String
	},
	{ _id: false }
);

billSchema.index({ billNumber: 1, congress: 1 }, { unique: true });

export default mongoose.models.Bill ?? mongoose.model('Bill', billSchema);
