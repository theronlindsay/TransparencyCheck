import 'dotenv/config';
import { importFecBulkData, parseFecBulkArgs } from './src/lib/server/fec-bulk-import.js';

async function main() {
	const args = parseFecBulkArgs(process.argv.slice(2));
	const summaries = await importFecBulkData(args);
	console.log('[FEC bulk] Import complete', summaries);
}

main().catch((error) => {
	console.error('[FEC bulk] Import failed:', error);
	process.exitCode = 1;
});
