import { json } from '@sveltejs/kit';
import Stripe from 'stripe';
import mongo from '$lib/db/mongo.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';

export async function POST({ request }) {
    const sig = request.headers.get('stripe-signature');
    const rawBody = await request.text();

    let event;

    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        return json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    try {
        const db = await mongo();
        const usersCollection = db.collection('user'); // Better Auth standard collection is "user"

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.metadata.userId;
                
                if (userId) {
                    await usersCollection.updateOne(
                        { id: userId },
                        { $set: { subscriptionTier: 'pro' } }
                    );
                    console.log(`User ${userId} upgraded to PRO tier.`);
                }
                break;
            }
                
            case 'customer.subscription.deleted': {
                // Wait for better-auth to include metadata in sub object, for now querying by customer id 
                // Would usually map stripeCustomerId to local db
                console.log('Subscription canceled or deleted. Must revert user to free tier.');
                // Placeholder - Needs customer mapping to userId
                break;
            }
                
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return json({ received: true });
    } catch (dbError) {
        console.error('Database error processing webhook:', dbError);
        return json({ error: 'Database processing failed' }, { status: 500 });
    }
}
