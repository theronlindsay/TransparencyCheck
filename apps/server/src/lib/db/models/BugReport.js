import mongoose from '../mongoose.js';

const bugReportAttachmentSchema = new mongoose.Schema(
	{
		fileKey: String,
		url: String,
		name: String,
		size: Number,
		type: String
	},
	{ _id: false }
);

const bugReportSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		description: { type: String, required: true, trim: true },
		email: { type: String, default: '', trim: true },
		pageUrl: { type: String, default: '', trim: true },
		userAgent: { type: String, default: '', trim: true },
		status: { type: String, default: 'new', trim: true },
		attachment: { type: bugReportAttachmentSchema, default: null }
	},
	{ timestamps: true }
);

export const BugReport = mongoose.models.BugReport || mongoose.model('BugReport', bugReportSchema);
