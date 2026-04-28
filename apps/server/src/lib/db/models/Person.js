import mongoose from '../mongoose.js';

const sponsoredBillSchema = new mongoose.Schema(
	{
		billId: String,
		displayTitle: String,
		introducedDate: String,
		congress: Number
	},
	{ _id: false }
);

const donorSchema = new mongoose.Schema(
	{
		donorName: String,
		amount: Number,
		date: String
	},
	{ _id: false }
);

const financeCommitteeSchema = new mongoose.Schema(
	{
		committeeId: String,
		name: String,
		designation: String,
		designationFull: String,
		type: String,
		typeFull: String,
		filingFrequency: String,
		isPrincipal: Boolean,
		isAuthorized: Boolean
	},
	{ _id: false }
);

const financeTotalsSchema = new mongoose.Schema(
	{
		receipts: { type: Number, default: 0 },
		disbursements: { type: Number, default: 0 },
		cash_on_hand: { type: Number, default: 0 }
	},
	{ _id: false }
);

const financeScopeSchema = new mongoose.Schema(
	{
		scope: String,
		committeeIds: [String],
		totals: financeTotalsSchema,
		donors: [donorSchema]
	},
	{ _id: false }
);

const stockTradeCacheSchema = new mongoose.Schema(
	{
		ticker: String,
		companyName: String,
		transactionDate: Date,
		disclosureDate: Date,
		transactionType: String,
		amountRange: String,
		source: String
	},
	{ _id: false }
);

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
		sponsoredBills: [sponsoredBillSchema],
		fec_candidate_id: String,
		fec_candidate_id_locked: { type: Boolean, default: false },
		url: String,
		financialData: {
			fecCandidateId: String,
			committees: [financeCommitteeSchema],
			scopeData: {
				principal: financeScopeSchema,
				authorized: financeScopeSchema
			},
			selectedScope: String,
			includedCommitteeIds: [String],
			totals: financeTotalsSchema,
			donors: [donorSchema],
			lastSyncedAt: Date,
			donorAggVersion: { type: Number, default: 0 }
		},
		stockData: {
			trades: [stockTradeCacheSchema],
			lastSyncedAt: Date
		}
	},
	{ _id: false }
);

export default mongoose.models.Person ?? mongoose.model('Person', personSchema);
