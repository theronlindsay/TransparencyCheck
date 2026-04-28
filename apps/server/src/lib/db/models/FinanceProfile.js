import mongoose from 'mongoose';

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

// Defines the Finance Profile natively to aggregate totals and an array of individual donations natively
const financeProfileSchema = new mongoose.Schema(
	{
		politicianId: {
			type: String, // bioguideId
			required: true,
			index: true,
			unique: true
		},
		committees: [financeCommitteeSchema],
		scopeData: {
			principal: financeScopeSchema,
			authorized: financeScopeSchema
		},
		selectedScope: {
			type: String,
			default: 'authorized'
		},
		includedCommitteeIds: [String],
		totals: financeTotalsSchema,
		donors: [donorSchema],
		lastSyncedAt: {
			type: Date,
			default: Date.now
		},
		/** Bump when donor fetch strategy changes (triggers one-time refetch). */
		donorAggVersion: {
			type: Number,
			default: 0
		},
		/** FEC candidate_id used for this cached snapshot (OpenFEC). */
		fecCandidateId: {
			type: String,
			default: null
		}
	},
	{ timestamps: true }
);

export const FinanceProfile =
	mongoose.models.FinanceProfile || mongoose.model('FinanceProfile', financeProfileSchema);
