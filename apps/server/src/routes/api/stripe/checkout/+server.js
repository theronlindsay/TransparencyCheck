import { json } from '@sveltejs/kit';
import Stripe from 'stripe';
import { getAuth } from '$lib/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

export async function POST({ request, url }) {
    const auth = await getAuth();
    
    // Convert SvelteKit request to Fetch API request for Better Auth
    const headers = new Headers();
    request.headers.forEach((value, key) => headers.set(key, value));
    
    const sessionResponse = await auth.api.getSession({
        headers
    });
    
    if (!sessionResponse || !sessionResponse.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const origin = request.headers.get('origin') || url.origin || 'http://localhost:5173';
        
        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'TransparencyCheck Pro',
                            description: 'Advanced AI analysis, unlimited saved bills, and notifications.',
                        },
                        unit_amount: 999, // $9.99
                        recurring: {
                            interval: 'month'
                        }
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/pricing?success=true`,
            cancel_url: `${origin}/pricing?canceled=true`,
            metadata: {
                userId: sessionResponse.user.id
            }
        });

        return json({ url: checkoutSession.url });
    } catch (err) {
        console.error('Error creating checkout session:', err);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
