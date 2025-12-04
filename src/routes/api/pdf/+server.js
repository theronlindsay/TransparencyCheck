import { json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Directory to store downloaded PDFs
const PDF_CACHE_DIR = path.join(process.cwd(), '.cache', 'pdfs');

// Ensure cache directory exists
async function ensureCacheDir() {
	try {
		await fs.mkdir(PDF_CACHE_DIR, { recursive: true });
	} catch (err) {
		console.error('Error creating cache directory:', err);
	}
}

// Generate a safe filename from URL using proper hash
function generateFileName(url) {
	const hash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 32);
	return `${hash}.pdf`;
}

export async function GET({ url }) {
	const pdfUrl = url.searchParams.get('url');
	
	if (!pdfUrl) {
		return json({ error: 'URL parameter is required' }, { status: 400 });
	}

	try {
		await ensureCacheDir();
		
		const fileName = generateFileName(pdfUrl);
		const filePath = path.join(PDF_CACHE_DIR, fileName);
		
		// Check if PDF is already cached
		let pdfBuffer;
		try {
			pdfBuffer = await fs.readFile(filePath);
			console.log(`Serving cached PDF: ${fileName}`);
		} catch (err) {
			// File doesn't exist, download it
			console.log(`Downloading PDF from: ${pdfUrl}`);
			const response = await fetch(pdfUrl);
			
			if (!response.ok) {
				throw new Error(`Failed to fetch PDF: ${response.status}`);
			}
			
			pdfBuffer = await response.arrayBuffer();
			
			// Cache the PDF
			await fs.writeFile(filePath, Buffer.from(pdfBuffer));
			console.log(`Cached PDF: ${fileName}`);
		}
		
		return new Response(pdfBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': 'inline; filename="bill.pdf"',
				'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
			}
		});
	} catch (error) {
		console.error('Error handling PDF:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
