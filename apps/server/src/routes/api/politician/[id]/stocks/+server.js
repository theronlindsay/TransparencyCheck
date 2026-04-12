import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import { StockTrade } from '$lib/db/models/StockTrade.js';

export async function GET({ params, url }) {
    const bioguideId = params.id?.toUpperCase();
    const nameParam = url.searchParams.get('name');

    if (!bioguideId) {
        return json({ error: 'Missing bioguideId parameter' }, { status: 400 });
    }

    console.log('[STOCKS API] attempt', {
        bioguideId,
        name: nameParam
            ? `${nameParam.slice(0, 80)}${nameParam.length > 80 ? '…' : ''}`
            : null
    });

    try {
        await mongo();
        
        // Match regardless of historical casing on politicianId
        const esc = bioguideId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const stockData = await StockTrade.find({ politicianId: new RegExp(`^${esc}$`, 'i') })
            .sort({ transactionDate: -1 })
            .limit(150)
            .lean();

        console.log('[STOCKS API] result', { bioguideId, tradeCount: stockData.length });
        return json({ stocks: stockData });

    } catch (err) {
        console.error('[STOCKS API] DB Error:', err);
        return json({ error: 'Database error' }, { status: 500 });
    }
}
