import { initDatabase } from '$lib/db/index.js';
import { syncAndFetchBills } from '$lib/db/bills.js';

export async function load() {
  // Ensure the database is initialized on server start
  await initDatabase();
  // Fetch the most recently updated bills
  const bills = await syncAndFetchBills();
  return { bills };
}