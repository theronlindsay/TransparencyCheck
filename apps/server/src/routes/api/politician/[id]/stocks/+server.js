import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import { StockTrade } from '$lib/db/models/StockTrade.js';
import { emptyStockData, normalizeStockData } from '$lib/server/person-cache.js';

export async function GET({ params }) {
	const bioguideId = params.id?.toUpperCase();

	if (!bioguideId) {
		return json({ error: 'Missing bioguideId parameter' }, { status: 400 });
	}

	try {
		await mongo();

		const person = await Person.findById(bioguideId).select('stockData').lean();
		if (person?.stockData) {
			return json({ stocks: normalizeStockData(person.stockData).trades });
		}

		const esc = bioguideId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const stockData = await StockTrade.find({ politicianId: new RegExp(`^${esc}$`, 'i') })
			.sort({ transactionDate: -1 })
			.limit(150)
			.lean();

		return json({ stocks: emptyStockData({ trades: stockData }).trades });
	} catch (err) {
		console.error('[STOCKS API] DB Error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
