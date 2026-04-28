<script>
	import { onMount } from 'svelte';
	import { onDestroy } from 'svelte';
	import PdfViewer from '$lib/Components/PdfViewer.svelte';
	import AuthModal from '$lib/Components/AuthModal.svelte';
	import { apiUrl } from '$lib/config.js';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
	import {
		registerAssistantSource,
		unregisterAssistantSource,
		updateAssistantSourceData
	} from '$lib/stores/assistant-context.js';
	import posthog from 'posthog-js';

	// Reactive state for bill data (fetched client-side)
	let bill = $state(null);
	let textVersions = $state([]);
	let actions = $state([]);
	let isLoading = $state(true);
	let isLoadingTextVersions = $state(false);
	let loadError = $state(null);
	let isSaved = $state(false);
	let isSaving = $state(false);

	let showAuthModal = $state(false);
	let authModalFeature = $state('');

	// Mobile PDF Viewer Logic
	let showMobilePdf = $state(false);
	let touchStartY = 0;

	function openMobilePdf() {
		showMobilePdf = true;
		if (browser) document.body.style.overflow = 'hidden';
		posthog.capture('bill_pdf_opened', { bill_id: $page.params.id });
	}

	function closeMobilePdf() {
		showMobilePdf = false;
		if (browser) document.body.style.overflow = '';
		posthog.capture('bill_pdf_closed', { bill_id: $page.params.id });
	}

	function handleOverlayTouchStart(e) {
		touchStartY = e.touches[0].clientY;
	}

	function handleOverlayTouchEnd(e) {
		const touchEndY = e.changedTouches[0].clientY;
		if (touchEndY - touchStartY > 50) {
			// Swipe down threshold
			closeMobilePdf();
		}
	}

	// Handle back button for mobile PDF viewer
	$effect(() => {
		if (browser && showMobilePdf) {
			const handlePopState = (event) => {
				event.preventDefault();
				closeMobilePdf();
				// Prevent the default back navigation
				window.history.pushState(null, '', window.location.href);
			};

			window.addEventListener('popstate', handlePopState);

			// Push a new state to enable back button interception
			window.history.pushState(null, '', window.location.href);

			return () => {
				window.removeEventListener('popstate', handlePopState);
			};
		}
	});

	let billFetchGeneration = 0;

	// Fetch bill data client-side (uncached bills may take longer; spinner until this completes)
	async function fetchBillFromAPI(billId) {
		const gen = ++billFetchGeneration;
		isLoading = true;
		isLoadingTextVersions = false;
		loadError = null;
		bill = null;
		textVersions = [];
		actions = [];
		isSaved = false;
		try {
			const response = await fetch(apiUrl(`/api/bills/${encodeURIComponent(billId)}`));
			if (gen !== billFetchGeneration) return;
			if (!response.ok) {
				const errText = await response.text();
				let detail = String(response.status);
				try {
					const errJson = JSON.parse(errText);
					if (errJson?.error) detail = errJson.error;
				} catch {
					if (errText?.trim()) detail = errText.trim().slice(0, 160);
				}
				throw new Error(
					response.status === 404
						? `Bill not found (${billId}). It may not exist in Congress.gov for recent sessions, or the server could not load it.`
						: `Could not load bill (${detail})`
				);
			}
			const result = await response.json();
			if (gen !== billFetchGeneration) return;
			bill = result.bill;
			textVersions = result.textVersions || [];
			actions = result.actions || [];
			if ((result.bill?.textVersionsCount || 0) > 0) {
				void fetchTextVersionsFromAPI(billId, gen);
			}

			const saveBillKey = result.bill?.number ?? result.bill?.id ?? billId;
			const saveRes = await fetch(
				apiUrl(`/api/bills/save?billId=${encodeURIComponent(saveBillKey)}`)
			);
			if (gen !== billFetchGeneration) return;
			if (saveRes.ok) {
				const saveData = await saveRes.json();
				isSaved = saveData.isSaved;
			}
		} catch (err) {
			if (gen !== billFetchGeneration) return;
			console.error('Error fetching bill:', err);
			loadError = err.message ?? 'Failed to load bill';
		} finally {
			if (gen === billFetchGeneration) {
				isLoading = false;
			}
		}
	}

	async function fetchTextVersionsFromAPI(billId, gen = billFetchGeneration) {
		isLoadingTextVersions = true;
		try {
			const response = await fetch(
				apiUrl(`/api/bills/${encodeURIComponent(billId)}/text-versions`)
			);
			if (gen !== billFetchGeneration) return;
			if (!response.ok) {
				throw new Error(`Failed to load bill text versions (${response.status})`);
			}
			const result = await response.json();
			if (gen !== billFetchGeneration) return;
			textVersions = result.textVersions || [];
		} catch (err) {
			if (gen !== billFetchGeneration) return;
			console.error('Error fetching bill text versions:', err);
		} finally {
			if (gen === billFetchGeneration) {
				isLoadingTextVersions = false;
			}
		}
	}

	async function toggleSaveBill() {
		if (isSaving || !bill) return;
		isSaving = true;

		try {
			const action = isSaved ? 'unsave' : 'save';
			const res = await fetch(apiUrl('/api/bills/save'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ billId: bill.number, title: bill.title, action })
			});
			if (res.ok) {
				const data = await res.json();
				isSaved = data.isSaved;
				posthog.capture(`bill_${action}`, { bill_id: bill.number });
			} else if (res.status === 401) {
				// Require login if unauthorized
				authModalFeature = 'save bills to your account';
				showAuthModal = true;
			}
		} catch (err) {
			console.error('Error toggling save status:', err);
		} finally {
			isSaving = false;
		}
	}

	// On mount, fetch from API
	$effect(() => {
		if (browser) {
			const billId = $page.params.id;
			fetchBillFromAPI(billId);
		}
	});

	function handleRetry() {
		window.location.reload();
	}

	// State for active tab
	let activeVersionType = $state(null);
	let activeFormat = $state(null);
	let htmlContent = $state('');
	let aiTextContent = $state(''); // Separate text content for AI summarizer
	let isLoadingHtml = $state(false);

	onMount(() => {
		registerAssistantSource('bill-page', {
			pageType: 'bill',
			pageLabel: 'Bill Detail Page',
			isActive: (pathname) => pathname.startsWith('/bill/'),
			data: {},
			dataSources: [
				{
					id: 'bill-metadata',
					description: 'Bill number, title, status, sponsor, committee, and actions.'
				},
				{
					id: 'bill-text',
					description: 'Fetched bill text content and formatted sections where available.'
				}
			],
			suggestions: [
				{ id: 'summarize-bill', label: 'Summarize this bill', action: 'open-summarizer' }
			]
		});
	});

	onDestroy(() => {
		unregisterAssistantSource('bill-page');
	});

	// Group text versions by type (e.g., "Introduced in House", "Engrossed in House")
	let versionsByType = $derived.by(() => {
		if (!textVersions || textVersions.length === 0) {
			return {};
		}

		const grouped = {};
		textVersions.forEach((version) => {
			const type = version.type || 'Unknown';

			if (!grouped[type]) {
				grouped[type] = {
					type,
					count: 0,
					formats: []
				};
			}
			grouped[type].count++;
			grouped[type].formats.push({
				url: version.url,
				date: version.date,
				formatType: version.formatType,
				content: version.content,
				contentFetched: version.contentFetched
			});
		});

		// Sort formats to put PDF first
		Object.keys(grouped).forEach((type) => {
			grouped[type].formats.sort((a, b) => {
				const aIsPdf = a.formatType?.toUpperCase() === 'PDF' ? 0 : 1;
				const bIsPdf = b.formatType?.toUpperCase() === 'PDF' ? 0 : 1;
				return aIsPdf - bIsPdf;
			});
		});

		return grouped;
	});

	// Format sponsor display - show first sponsor's name and party
	function formatSponsor(sponsors) {
		if (!sponsors || sponsors.length === 0) return 'Unknown';

		const mainSponsor = sponsors[0];
		if (!mainSponsor) return 'Unknown';

		const name = `${mainSponsor.firstName || ''} ${mainSponsor.lastName || ''}`.trim();
		const party = mainSponsor.party ? ` [${mainSponsor.party}]` : '';

		// Fallback if the object is malformed but exists
		if (!name) return 'Unknown';

		return name + party;
	}

	// Set initial active version when data loads
	$effect(() => {
		if (!activeVersionType && Object.keys(versionsByType).length > 0) {
			const firstType = Object.keys(versionsByType)[0];
			activeVersionType = firstType;

			if (versionsByType[firstType].formats.length > 0) {
				activeFormat = versionsByType[firstType].formats[0];
			}
		}
	});

	// Pre-load text content for AI summarizer (find first HTML format)
	$effect(() => {
		if (textVersions.length > 0 && !aiTextContent) {
			// Find the first formatted text/HTML version
			const htmlVersion = textVersions.find(
				(v) =>
					v.formatType?.toUpperCase() === 'FORMATTED TEXT' ||
					v.formatType?.toUpperCase()?.includes('HTM')
			);

			if (htmlVersion) {
				// Check if content is already stored in database
				if (htmlVersion.contentFetched && htmlVersion.content) {
					aiTextContent = htmlVersion.content;
				} else {
					fetch(apiUrl(`/api/fetch-bill-text?url=${encodeURIComponent(htmlVersion.url)}`))
						.then((response) => response.json())
						.then((data) => {
							if (!data.error) {
								aiTextContent = data.content;
							}
						})
						.catch((err) => {
							console.error('Error loading text for AI:', err);
						});
				}
			}
		}
	});

	$effect(() => {
		if (!bill) return;
		updateAssistantSourceData('bill-page', {
			billId: $page.params.id,
			billNumber: bill.number,
			billTitle: bill.title,
			billSummary: bill.summary || bill.summaryLong || '',
			billText: aiTextContent || ''
		});
	});

	// Load HTML content when active format changes
	$effect(() => {
		if (!activeFormat) return;

		const formatType = activeFormat.formatType?.toUpperCase();
		if (formatType === 'FORMATTED TEXT' || formatType?.includes('HTM')) {
			isLoadingHtml = true;

			// Check if content is already stored in database
			if (activeFormat.contentFetched && activeFormat.content) {
				htmlContent = activeFormat.content;
				isLoadingHtml = false;
			} else {
				htmlContent = '';

				// Use our API proxy to fetch the content (avoids CORS issues)
				fetch(apiUrl(`/api/fetch-bill-text?url=${encodeURIComponent(activeFormat.url)}`))
					.then((response) => response.json())
					.then((data) => {
						if (data.error) {
							throw new Error(data.error);
						}
						htmlContent = data.content;
						isLoadingHtml = false;
					})
					.catch((err) => {
						console.error('Error loading HTML:', err);
						htmlContent =
							'<p>Error loading bill text. You can <a href="' +
							activeFormat.url +
							'" target="_blank" rel="noopener noreferrer">view it directly on Congress.gov</a>.</p>';
						isLoadingHtml = false;
					});
			}
		} else if (formatType?.includes('XML')) {
			// For XML, fetch and display with formatting
			isLoadingHtml = true;
			htmlContent = '';

			fetch(apiUrl(`/api/fetch-bill-text?url=${encodeURIComponent(activeFormat.url)}`))
				.then((response) => response.json())
				.then((data) => {
					if (data.error) {
						throw new Error(data.error);
					}
					// Store XML content - will be displayed in pre tag
					htmlContent = data.content;
					isLoadingHtml = false;
				})
				.catch((err) => {
					console.error('Error loading XML:', err);
					htmlContent = 'Error loading XML content. You can view it directly on Congress.gov.';
					isLoadingHtml = false;
				});
		} else {
			htmlContent = '';
			isLoadingHtml = false;
		}
	});

	function selectVersion(type, format) {
		activeVersionType = type;
		activeFormat = format;
	}

	function formatDate(dateString) {
		if (!dateString) return 'N/A';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return 'N/A';
		}
	}

	function formatVersionType(type) {
		// Convert type codes to readable names
		const typeMap = {
			IH: 'Introduced in House',
			IS: 'Introduced in Senate',
			RH: 'Reported in House',
			RS: 'Reported in Senate',
			EH: 'Engrossed in House',
			ES: 'Engrossed in Senate',
			ENR: 'Enrolled',
			RDS: 'Received in Senate',
			RDH: 'Received in House'
		};
		return typeMap[type] || type;
	}

	function getFormatIcon(formatType) {
		const format = formatType?.toUpperCase();
		if (format === 'PDF') return '📄';
		if (format === 'FORMATTED TEXT' || format?.includes('HTM')) return '🌐';
		if (format?.includes('XML')) return '📋';
		if (format === 'TXT') return '📝';
		return '📎';
	}

	function getCongressUrl(billNumber, congress) {
		// Parse bill number like "H.R.3062", "S.1234", "HR3062", "S.RES.123", "H.J.RES.45"
		// Remove all dots and spaces first, then match
		const cleaned = billNumber?.replace(/[.\s]/g, '').toUpperCase();
		const match = cleaned?.match(/^([A-Z]+)(\d+)$/i);
		if (!match || !congress) {
			console.warn(`Failed to parse bill number: ${billNumber} (cleaned: ${cleaned})`);
			return '';
		}

		const billType = match[1].toLowerCase(); // "hr", "s", "hres", "hjres", etc.
		const billNum = match[2];

		// Format congress number as "119th-congress"
		const congressFormatted = `${congress}th-congress`;

		// Map bill type codes to Congress.gov format
		const typeMap = {
			hr: 'house-bill',
			hres: 'house-resolution',
			hjres: 'house-joint-resolution',
			hconres: 'house-concurrent-resolution',
			s: 'senate-bill',
			sres: 'senate-resolution',
			sjres: 'senate-joint-resolution',
			sconres: 'senate-concurrent-resolution'
		};

		const billTypeFormatted = typeMap[billType] || `${billType}-bill`;
		const url = `https://www.congress.gov/bill/${congressFormatted}/${billTypeFormatted}/${billNum}`;
		return url;
	}

	function openExternal(url) {
		if (!url || !browser) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

{#if isLoading}
	<div class="page-container bill-loading-screen" role="status" aria-live="polite" aria-busy="true">
		<div class="bill-loading-inner elevated-surface">
			<div class="spinner" aria-hidden="true"></div>
			<p class="bill-loading-title">Loading bill…</p>
			<p class="bill-loading-id">{$page.params.id}</p>
		</div>
	</div>
{:else if loadError}
	<div class="error-container elevated-surface">
		<p class="error-message">{loadError}</p>
		<button onclick={handleRetry}>Retry</button>
	</div>
{:else if !bill}
	<div class="error-container elevated-surface">
		<p class="error-message">Bill not found</p>
	</div>
{:else}
	<div class="page-container" role="presentation">
		<!-- Main Content -->
		<div class="main-content">
			<div class="bill-detail-page">
				<div class="bill-header elevated-surface">
					<div class="header-top">
						<span class="bill-number">{bill.number}</span>
					</div>
					<h1 class="bill-title">{bill.title}</h1>

					<div class="bill-meta">
						<div class="meta-item">
							<span class="meta-label">Status</span>
							<span class="badge" style="width: min-content;">{bill.statusTag || 'Unknown'}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Sponsor</span>
							<span class="meta-value">
								{#if bill.sponsors && bill.sponsors[0] && bill.sponsors[0].bioguideId}
									<a href={resolve(`/member/${bill.sponsors[0].bioguideId}`)} class="sponsor-link">
										{formatSponsor(bill.sponsors)}
									</a>
								{:else}
									{formatSponsor(bill.sponsors)}
								{/if}
							</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Committee</span>
							<span class="meta-value">{bill.primaryCommitteeName || 'Unassigned'}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Last Updated</span>
							<span class="meta-value">{formatDate(bill.updatedAt)}</span>
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="action-buttons">
						<button
							type="button"
							class="button {isSaved ? 'secondary' : 'primary'}"
							disabled={isSaving}
							onclick={toggleSaveBill}
							style="margin-right: 0.5rem;"
						>
							{#if isSaved}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="currentColor"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
								</svg>
								Saved
							{:else}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
								</svg>
								Save Bill
							{/if}
						</button>
						<button
							type="button"
							class="button primary"
							onclick={() => openExternal(getCongressUrl(bill.number, bill.congress))}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z"
									fill="currentColor"
								/>
								<path
									d="M13 5L11.59 6.41L9 3.83V12H7V3.83L4.41 6.41L3 5L8 0L13 5Z"
									fill="currentColor"
								/>
							</svg>
							View on Congress.gov
						</button>
					</div>
				</div>

				{#if bill.latestAction}
					<section class="section latest-action elevated-surface bill-section-panel">
						<h2>Latest Action</h2>
						<p class="action-text">{bill.latestAction}</p>
					</section>
				{/if}

				{#if actions && actions.length > 0}
					<section class="section elevated-surface bill-section-panel">
						<h2>Legislative Actions</h2>
						<p class="section-description">Complete timeline of all actions taken on this bill</p>
						<div class="timeline">
							{#each actions as action, actionIndex (`${action.actionDate || ''}-${action.text || actionIndex}`)}
								<div class="timeline-item">
									{#if action.actionDate}
										<span class="timeline-date">{formatDate(action.actionDate)}</span>
									{/if}
									<p class="timeline-text">{action.text || 'Action recorded'}</p>
									{#if action.type}
										<span class="action-type-badge">{action.type}</span>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if bill.summary}
					<section class="section elevated-surface bill-section-panel">
						<h2>Summary</h2>
						<p class="summary-text">{bill.summary}</p>
					</section>
				{/if}

				{#if bill.summaryLong && bill.summaryLong !== bill.summary}
					<section class="section elevated-surface bill-section-panel">
						<h2>Detailed Summary</h2>
						<p class="summary-text">{bill.summaryLong}</p>
					</section>
				{/if}

				{#if bill.votes && bill.votes.length > 0}
					<section class="section elevated-surface bill-section-panel">
						<h2>Votes</h2>
						<div class="votes-grid">
							{#each bill.votes as vote, voteIndex (`${vote.date || ''}-${vote.result || vote.title || voteIndex}`)}
								<div class="card">
									<h3>{vote.title || 'Vote Record'}</h3>
									{#if vote.date}
										<p class="vote-date">{formatDate(vote.date)}</p>
									{/if}
									{#if vote.result}
										<p class="vote-result"><strong>Result:</strong> {vote.result}</p>
									{/if}
									{#if vote.yeas !== undefined && vote.nays !== undefined}
										<div class="vote-counts">
											<span class="yeas">Yeas: {vote.yeas}</span>
											<span class="nays">Nays: {vote.nays}</span>
											{#if vote.present !== undefined}
												<span class="present">Present: {vote.present}</span>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if bill.schedule && bill.schedule.length > 0}
					<section class="section elevated-surface bill-section-panel">
						<h2>Schedule</h2>
						<div class="timeline">
							{#each bill.schedule as item, scheduleIndex (`${item.date || ''}-${item.description || item.text || scheduleIndex}`)}
								<div class="timeline-item">
									{#if item.date}
										<span class="timeline-date">{formatDate(item.date)}</span>
									{/if}
									<p class="timeline-text">{item.description || item.text || 'Scheduled event'}</p>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if bill.news && bill.news.length > 0}
					<section class="section elevated-surface bill-section-panel">
						<h2>Related News</h2>
						<div class="news-grid">
							{#each bill.news as article, articleIndex (`${article.url || ''}-${article.title || articleIndex}`)}
								<div class="card news-card">
									{#if article.title}
										<h3>{article.title}</h3>
									{/if}
									{#if article.source}
										<p class="news-source">{article.source}</p>
									{/if}
									{#if article.date}
										<p class="news-date">{formatDate(article.date)}</p>
									{/if}
									{#if article.url}
										<button
											type="button"
											class="news-link"
											onclick={() => openExternal(article.url)}
										>
											Read Article →
										</button>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Bill Text Versions Section -->
				{#if isLoadingTextVersions || (textVersions && textVersions.length > 0)}
					<section class="section text-versions elevated-surface bill-section-panel">
						<h2>Bill Text Versions</h2>
						<p class="section-description">View different versions of this bill text</p>

						{#if isLoadingTextVersions}
							<div class="loading-preview">
								<div class="spinner"></div>
								<p>Fetching bill text from Congress.gov…</p>
							</div>
						{:else}
							<!-- Version Tabs -->
							<div class="version-tabs">
								{#each Object.entries(versionsByType) as [type, versionData] (type)}
									<div class="version-tab-group">
										<div class="version-type-header">
											<h3>{formatVersionType(type)}</h3>
											{#if versionData.date}
												<span class="version-date">{formatDate(versionData.date)}</span>
											{/if}
										</div>

										<div class="format-tabs">
											{#each versionData.formats as format (format.url)}
												<button
													class="format-tab"
													class:active={activeVersionType === type &&
														activeFormat?.url === format.url}
													onclick={() => selectVersion(type, format)}
												>
													<span class="format-icon">{getFormatIcon(format.formatType)}</span>
													<span class="format-label">{format.formatType}</span>
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>

							<!-- Preview Area -->
							{#if activeFormat}
								<div class="preview-area">
									<div class="preview-header">
										<h3>
											Preview: {formatVersionType(activeVersionType)} - {activeFormat.formatType}
										</h3>
										<button
											type="button"
											class="download-link"
											onclick={() => openExternal(activeFormat.url)}
										>
											<svg
												width="16"
												height="16"
												viewBox="0 0 16 16"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z"
													fill="currentColor"
												/>
												<path
													d="M7 3V9.17L4.41 6.58L3 8L8 13L13 8L11.59 6.58L9 9.17V3H7Z"
													fill="currentColor"
												/>
											</svg>
											Download from Congress.gov
										</button>
									</div>

									{#if isLoadingHtml}
										<div class="loading-preview">
											<div class="spinner"></div>
											<p>Loading bill text...</p>
										</div>
									{:else if htmlContent}
										<div class="html-content">
											<iframe class="html-frame" title="Bill text preview" srcdoc={htmlContent}
											></iframe>
										</div>
									{:else if activeFormat.formatType?.toUpperCase() === 'PDF'}
										<div class="desktop-pdf-view">
											<PdfViewer
												url={apiUrl(`/api/pdf?url=${encodeURIComponent(activeFormat.url)}`)}
											/>
										</div>

										<div class="mobile-pdf-view">
											<button class="view-pdf-btn" onclick={openMobilePdf}>
												<span class="icon">📄</span>
												View PDF Document
											</button>
										</div>
									{:else if activeFormat.formatType?.toUpperCase().includes('XML')}
										{#if isLoadingHtml}
											<div class="loading-preview">
												<div class="spinner"></div>
												<p>Loading XML content...</p>
											</div>
										{:else if htmlContent}
											<div class="xml-content">
												<pre><code>{htmlContent}</code></pre>
											</div>
										{:else}
											<div class="download-message">
												<div class="format-icon-large">📋</div>
												<h4>XML Format</h4>
												<p>Unable to load XML content.</p>
												<button
													type="button"
													class="download-button"
													onclick={() => openExternal(activeFormat.url)}
												>
													<svg
														width="20"
														height="20"
														viewBox="0 0 16 16"
														fill="none"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path
															d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z"
															fill="currentColor"
														/>
														<path
															d="M7 3V9.17L4.41 6.58L3 8L8 13L13 8L11.59 6.58L9 9.17V3H7Z"
															fill="currentColor"
														/>
													</svg>
													Download XML
												</button>
											</div>
										{/if}
									{:else}
										<div class="download-message">
											<div class="format-icon-large">{getFormatIcon(activeFormat.formatType)}</div>
											<h4>{activeFormat.formatType} Format</h4>
											<p>This format cannot be previewed in the browser.</p>
											<button
												type="button"
												class="download-button"
												onclick={() => openExternal(activeFormat.url)}
											>
												<svg
													width="20"
													height="20"
													viewBox="0 0 16 16"
													fill="none"
													xmlns="http://www.w3.org/2000/svg"
												>
													<path
														d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z"
														fill="currentColor"
													/>
													<path
														d="M7 3V9.17L4.41 6.58L3 8L8 13L13 8L11.59 6.58L9 9.17V3H7Z"
														fill="currentColor"
													/>
												</svg>
												Download and View
											</button>
										</div>
									{/if}
								</div>
							{/if}
						{/if}
					</section>
				{:else}
					<section class="section text-versions-unavailable elevated-surface bill-section-panel">
						<h2>Bill Text</h2>
						<p class="unavailable-message">
							Text versions are being loaded or not yet available for this bill.
						</p>
					</section>
				{/if}
			</div>
		</div>
	</div>

	{#if showMobilePdf && activeFormat}
		<div class="pdf-overlay" transition:fly={{ y: 1000, duration: 300 }}>
			<div class="pdf-header">
				<div
					class="pdf-handle-area"
					role="button"
					tabindex="0"
					ontouchstart={handleOverlayTouchStart}
					ontouchend={handleOverlayTouchEnd}
					onclick={closeMobilePdf}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							closeMobilePdf();
						}
					}}
					onkeyup={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							closeMobilePdf();
						}
					}}
				>
					<div class="pdf-handle"></div>
				</div>
			</div>
			<div class="pdf-overlay-content">
				<PdfViewer url={apiUrl(`/api/pdf?url=${encodeURIComponent(activeFormat.url)}`)} />
			</div>
			<button class="pdf-back-button" onclick={closeMobilePdf} aria-label="Close PDF viewer">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
				Back
			</button>
		</div>
	{/if}
{/if}

<AuthModal bind:show={showAuthModal} feature={authModalFeature} />

<style>
	.sponsor-link {
		color: var(--blue-accent);
		text-decoration: none;
		font-weight: 500;
	}
	.sponsor-link:hover {
		text-decoration: underline;
		color: var(--accent);
	}

	.bill-loading-screen {
		min-height: 55vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.bill-loading-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
		padding: 2rem 2.5rem;
		border-radius: var(--radius-lg);
	}

	.bill-loading-screen .spinner {
		width: 44px;
		height: 44px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-radius: 50%;
		border-top-color: var(--accent);
		animation: bill-spin 0.9s ease-in-out infinite;
	}

	@keyframes bill-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.bill-loading-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.bill-loading-id {
		margin: 0;
		font-size: 0.95rem;
		font-family: ui-monospace, monospace;
		color: var(--text-secondary);
		text-transform: uppercase;
	}

	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		gap: 1rem;
		padding: 2rem 1.5rem;
		max-width: 28rem;
		margin: 2rem auto;
		color: var(--text-secondary);
		border-radius: var(--radius-lg);
	}

	.error-message {
		color: var(--accent);
		font-size: 1.1rem;
	}

	.error-container button {
		padding: 0.5rem 1rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.page-container {
		max-width: 900px;
		margin: 0 auto;
		height: auto;
		overflow: visible;
	}

	.main-content {
		min-width: 0;
		overflow-y: visible;
		overflow-x: hidden;
		padding: 2em;
	}

	.main-content::-webkit-scrollbar {
		width: 8px;
	}

	.main-content::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
	}

	.main-content::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 4px;
	}

	.main-content::-webkit-scrollbar-thumb:hover {
		background: var(--accent);
	}

	.bill-detail-page {
		max-width: 100%;
		margin: 0;
		padding: 0;
	}

	.bill-header {
		margin-bottom: 3rem;
		padding: 1.75rem 1.5rem;
		border-radius: var(--radius-lg);
	}

	.header-top {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.bill-number {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.header-top {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.bill-number {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--accent);
		padding: 0.5rem 1rem;
		background: rgba(241, 58, 55, 0.05);
		border: 1px solid rgba(241, 58, 55, 0.2);
		border-radius: var(--radius-md);
	}

	.bill-title {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 1.5rem 0;
		line-height: 1.3;
	}

	.bill-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
		padding: 1.5rem;
		border-radius: var(--radius-md);
		background: var(--surface-3d-gradient);
		border: 1px solid rgba(255, 255, 255, 0.09);
		box-shadow: var(--shadow-3d-stack);
		transform: translateZ(0);
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.meta-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.meta-value {
		font-size: 1rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}

	.button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: all var(--transition-base);
		border: none;
	}

	.button.primary {
		background: var(--accent);
		color: white;
		border: 1px solid var(--accent);
	}

	.button.primary:hover {
		background: #ff5b58;
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(241, 58, 55, 0.4);
	}

	.section {
		margin-bottom: 3rem;
	}

	.section h2 {
		font-size: 1.8rem;
		color: var(--text-primary);
		margin-bottom: 1.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--border-color);
	}

	.bill-section-panel {
		padding: 1.5rem 1.35rem;
		border-radius: var(--radius-lg);
	}

	.latest-action {
		border-left: 4px solid var(--accent);
	}

	.latest-action h2 {
		border: none;
		padding-bottom: 0;
		margin-bottom: 1rem;
	}

	.action-text {
		font-size: 1.1rem;
		color: var(--text-primary);
		line-height: 1.7;
		margin: 0;
	}

	.summary-text {
		font-size: 1.05rem;
		color: var(--text-secondary);
		line-height: 1.8;
		margin: 0;
	}

	.votes-grid,
	.news-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.card {
		padding: 1.5rem;
		background: var(--surface-3d-gradient);
		border-radius: var(--radius-lg);
		border: 1px solid rgba(255, 255, 255, 0.09);
		box-shadow: var(--shadow-3d-stack);
		transform: translateZ(0);
	}

	.card h3 {
		font-size: 1.2rem;
		color: var(--text-primary);
		margin: 0 0 1rem 0;
	}

	.vote-date,
	.news-date,
	.news-source {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0.5rem 0;
	}

	.vote-result {
		margin: 0.75rem 0;
		color: var(--text-primary);
	}

	.vote-counts {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.vote-counts span {
		font-size: 0.95rem;
		font-weight: 600;
	}

	.yeas {
		color: #4ade80;
	}

	.nays {
		color: #f87171;
	}

	.present {
		color: var(--text-secondary);
	}

	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.timeline-item {
		padding-left: 2rem;
		border-left: 2px solid var(--border-color);
		position: relative;
	}

	.timeline-item::before {
		content: '';
		position: absolute;
		left: -6px;
		top: 0;
		width: 10px;
		height: 10px;
		background: var(--accent);
		border-radius: 50%;
	}

	.timeline-date {
		display: block;
		font-size: 0.85rem;
		color: var(--accent);
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.timeline-text {
		color: var(--text-primary);
		line-height: 1.6;
		margin: 0;
	}

	.action-type-badge {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.25rem 0.75rem;
		background: rgba(241, 58, 55, 0.1);
		border: 1px solid rgba(241, 58, 55, 0.3);
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--accent);
		text-transform: capitalize;
	}

	.news-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: none;
		background: transparent;
		padding: 0;
		cursor: pointer;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
		margin-top: 1rem;
		transition: all var(--transition-base);
	}

	.news-link:hover {
		color: #ff5b58;
		transform: translateX(4px);
	}

	/* Text Versions Styles */
	.text-versions h2 {
		margin: 0 0 0.5rem 0;
	}

	.section-description {
		color: var(--text-secondary);
		margin: 0 0 2rem 0;
		font-size: 0.95rem;
	}

	.version-tabs {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.version-tab-group {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 1.25rem;
	}

	.version-type-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.version-type-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.version-date {
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-weight: 400;
	}

	.format-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.format-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.2rem;
		background: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.format-tab:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(255, 91, 88, 0.2);
	}

	.format-tab.active {
		background: var(--accent);
		border-color: var(--accent);
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(255, 91, 88, 0.3);
	}

	.format-icon {
		font-size: 1.2rem;
		line-height: 1;
	}

	.format-label {
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.preview-area {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid var(--border-color);
		flex-wrap: wrap;
		gap: 1rem;
	}

	.preview-header h3 {
		margin: 0;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.download-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border: none;
		background: var(--accent);
		border-radius: var(--radius-sm);
		color: #ffffff;
		cursor: pointer;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.download-link:hover {
		background: #ff4845;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(255, 91, 88, 0.3);
	}

	.html-content {
		padding: 0;
		background: white;
		color: #000;
		max-height: 800px;
		overflow-y: auto;
	}

	.html-frame {
		width: 100%;
		min-height: 720px;
		border: none;
		background: #fff;
	}

	.html-content :global(p) {
		line-height: 1.8;
		margin: 1rem 0;
	}

	.html-content :global(h1),
	.html-content :global(h2),
	.html-content :global(h3) {
		margin-top: 2rem;
		margin-bottom: 1rem;
		color: #000;
	}

	.html-content :global(pre) {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.xml-content {
		padding: 2rem;
		background: rgba(0, 0, 0, 0.2);
		max-height: 800px;
		overflow: auto;
	}

	.xml-content pre {
		margin: 0;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--text-primary);
		white-space: pre-wrap;
		word-wrap: break-word;
		background: rgba(0, 0, 0, 0.3);
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		overflow-x: auto;
	}

	.xml-content code {
		font-family: 'Courier New', Courier, monospace;
		color: inherit;
	}

	.loading-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: 1rem;
	}

	.loading-preview p {
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.download-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: 1.5rem;
		text-align: center;
	}

	.format-icon-large {
		font-size: 4rem;
		line-height: 1;
		opacity: 0.8;
	}

	.download-message h4 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--text-primary);
	}

	.download-message p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 1rem;
		max-width: 500px;
	}

	.download-button {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 2rem;
		border: none;
		background: var(--accent);
		border-radius: var(--radius-md);
		color: #ffffff;
		cursor: pointer;
		text-decoration: none;
		font-size: 1.1rem;
		font-weight: 600;
		transition: all 0.2s ease;
		margin-top: 1rem;
	}

	.download-button:hover {
		background: #ff4845;
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(255, 91, 88, 0.4);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.text-versions-unavailable {
		text-align: center;
	}

	.unavailable-message {
		color: var(--text-secondary);
		margin: 0.5rem 0 0 0;
		font-size: 0.95rem;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.page-container {
			grid-template-columns: 1fr;
			gap: 2rem;
			height: auto; /* Remove fixed height on mobile */
			overflow: visible; /* Allow normal page scrolling */
		}

		.main-content {
			overflow-y: visible; /* Disable independent scrolling on mobile */
			overflow-x: visible;
			padding-right: 0; /* Remove scrollbar spacing */
			height: auto;
		}
	}

	@media (max-width: 768px) {
		.page-container {
			padding: 0.5rem;
		}
		.bill-detail-page {
			padding: 0.5rem;
		}

		.bill-title {
			font-size: 1.8rem;
			margin: 0 0 1rem 0;
		}

		.bill-meta {
			grid-template-columns: 1fr;
			gap: 0.75rem;
			padding: 0.75rem;
			margin-bottom: 1rem;
		}

		.section h2 {
			font-size: 1.5rem;
		}

		.votes-grid,
		.news-grid {
			grid-template-columns: 1fr;
		}

		.version-type-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.format-tabs {
			width: 100%;
		}

		.format-tab {
			flex: 1;
			justify-content: center;
			min-width: 100px;
		}

		.html-content {
			padding: 0.75rem;
			max-height: 600px;
		}

		.preview-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.card {
			padding: 0.75rem;
		}

		.latest-action {
			padding: 0.75rem;
		}

		.main-content {
			padding: 0.5rem;
		}
	}

	/* Mobile PDF Viewer */
	.desktop-pdf-view {
		display: block;
	}
	.mobile-pdf-view {
		display: none;
	}

	.view-pdf-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		width: 100%;
		padding: 1rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.view-pdf-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--accent);
	}

	.pdf-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: var(--bg-primary);
		z-index: 1000;
		display: flex;
		flex-direction: column;
	}

	.pdf-header {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	.pdf-back-button {
		position: absolute;
		bottom: 2rem;
		right: 2rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 1001;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.pdf-back-button:hover {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(241, 58, 55, 0.4);
	}

	.pdf-back-button svg {
		transition: transform 0.2s ease;
	}

	.pdf-back-button:hover svg {
		transform: translateX(-2px);
	}

	@media (max-width: 480px) {
		.pdf-back-button {
			bottom: 1rem;
			right: 1rem;
			padding: 0.6rem 1rem;
			font-size: 0.9rem;
		}
	}

	.pdf-handle-area {
		width: 100%;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		cursor: pointer;
		flex-shrink: 0;
	}

	.pdf-handle {
		width: 40px;
		height: 5px;
		background: var(--text-secondary);
		border-radius: 3px;
		opacity: 0.5;
	}

	.pdf-overlay-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	@media (max-width: 768px) {
		.desktop-pdf-view {
			display: none;
		}
		.mobile-pdf-view {
			display: block;
		}
	}
</style>
