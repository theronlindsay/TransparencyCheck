// Disable SSR for all routes - we're a client-side only app
// For static builds (Capacitor), the client will fetch data from the VPS API
export const ssr = false;

// Don't prerender - we handle data loading client-side
export const prerender = false;
