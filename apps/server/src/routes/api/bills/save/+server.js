import { json } from '@sveltejs/kit';
import { getAuth } from '$lib/auth.js';
import mongo from '$lib/db/mongo.js';
import { SavedBill } from '$lib/db/models/SavedBill.js';

export async function POST({ request, url }) {
    const auth = await getAuth();
    const headers = new Headers();
    request.headers.forEach((value, key) => headers.set(key, value));
    
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { billId, title, action } = await request.json();

        await mongo(); // Ensure DB is connected

        if (action === 'save') {
            await SavedBill.findOneAndUpdate(
                { userId: session.user.id, billId },
                { billId, title, userId: session.user.id },
                { upsert: true, new: true }
            );
            return json({ success: true, isSaved: true });
        } else if (action === 'unsave') {
            await SavedBill.deleteOne({ userId: session.user.id, billId });
            return json({ success: true, isSaved: false });
        }

        return json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('Error in save bill:', err);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET({ request, url }) {
    const auth = await getAuth();
    const headers = new Headers();
    request.headers.forEach((value, key) => headers.set(key, value));
    
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await mongo();
        
        const billId = url.searchParams.get('billId');
        if (billId) {
            const bill = await SavedBill.findOne({ userId: session.user.id, billId });
            return json({ success: true, isSaved: !!bill });
        } else {
            const bills = await SavedBill.find({ userId: session.user.id }).sort({ savedAt: -1 });
            return json({ success: true, bills });
        }
    } catch (err) {
        console.error('Error fetching saved bills:', err);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
