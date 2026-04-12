import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import { SavedBill } from '$lib/db/models/SavedBill.js';
import { Notification } from '$lib/db/models/Notification.js';

export async function GET({ request }) {
    // Basic Auth Check for cron job
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await mongo();

        // 1. Get all unique bill IDs currently saved by any user
        const distinctBillIds = await SavedBill.distinct('billId');
        
        let updateCount = 0;
        let notificationCount = 0;

        for (const billId of distinctBillIds) {
            // ** Pseudo-code for fetching bill status **
            // const apiRes = await fetch(`https://api.congress.gov/v3/bill/...`);
            // const billData = await apiRes.json();
            // const latestStatus = billData.status;

            const latestStatus = "Status Mock - Updated Action"; // Mock
            
            // Find all users saving this bill that have a differing status
            const outdatedSaves = await SavedBill.find({ billId, status: { $ne: latestStatus } });
            
            if (outdatedSaves.length > 0) {
                // Update their saved status
                await SavedBill.updateMany({ billId }, { $set: { status: latestStatus } });
                updateCount++;

                // Queue notifications for each user
                const notificationsToInsert = outdatedSaves.map(save => ({
                    userId: save.userId,
                    title: `Update on ${save.title || billId}`,
                    message: `The status has changed to: ${latestStatus}`,
                    link: `/bill/${billId}`,
                    read: false
                }));

                await Notification.insertMany(notificationsToInsert);
                notificationCount += notificationsToInsert.length;
            }
        }

        console.log(`[Cron] Bills checked. Updates: ${updateCount}. Notifications queued: ${notificationCount}`);
        
        return json({ success: true, updates: updateCount, notifications: notificationCount });
    } catch (err) {
        console.error('Error processing bill check cron:', err);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
