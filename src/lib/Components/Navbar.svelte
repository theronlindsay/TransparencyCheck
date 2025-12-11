<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	// Props for customization
	let { items = [
		{ id: 'home', label: 'Home', active: true, href: '/' },
		{ id: 'bills', label: 'Bills', active: false, href: '/bill' },
		{ id: 'heirarchy', label: 'Heirarchy', active: false, href: '/heirarchy' },
		{ id: 'chat', label: 'Chat', active: false, href: '/chat' }
	] } = $props();

	let activeItem = $derived.by(() => {
		const currentPath = $page.url.pathname;
		// Try exact match first
		let matchedItem = items.find(item => item.href === currentPath);
		// If no exact match, try partial match (e.g., /bill/HR1 matches /bill)
		if (!matchedItem) {
			matchedItem = items.find(item => item.href !== '/' && currentPath.startsWith(item.href));
		}
		return matchedItem?.id || items[0]?.id;
	});
	
	let visuallyActiveItem = $state('');
	let selectorElement;
	let navElement;
	let itemElements = {};

	// Update visual state when active item changes
	$effect(() => {
		visuallyActiveItem = activeItem;
		// Delay the selector movement slightly to ensure DOM is ready
		setTimeout(() => moveSelector(activeItem), 10);
	});

	// Function to move the selector to the active item
	function moveSelector(targetId) {
		if (!selectorElement || !itemElements[targetId]) return;

		const targetElement = itemElements[targetId];
		const containerRect = navElement.querySelector('.navbar-container').getBoundingClientRect();
		const targetRect = targetElement.getBoundingClientRect();
		
		// Calculate position relative to the navbar container, accounting for container padding
		const offsetX = targetRect.left - containerRect.left - 6; // Subtract container padding
		const width = targetRect.width;

		// Apply the transform with bounce animation
		selectorElement.style.transform = `translateX(${offsetX}px)`;
		selectorElement.style.width = `${width}px`;
	}

	// Handle item click
	function handleItemClick(itemId, href) {
		// Don't navigate if already on this page
		if (activeItem === itemId) return;
		
		moveSelector(itemId);
		
		// Delay the visual boldness change until near the end of animation (300ms out of 400ms)
		setTimeout(() => {
			visuallyActiveItem = itemId;
		}, 300);

		// Use SvelteKit's client-side navigation (no page reload!)
		if (href) {
			goto(href);
		}
	}

	// Initialize selector position
	onMount(() => {
		setTimeout(() => {
			moveSelector(activeItem);
			// Set initial visual state without delay
			visuallyActiveItem = activeItem;
		}, 50);
		
		// Handle window resize
		const handleResize = () => {
			moveSelector(activeItem);
		};
		
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<nav class="navbar" bind:this={navElement}>
	<div class="navbar-container">
		<!-- Background selector -->
		<div 
			class="selector" 
			bind:this={selectorElement}
		></div>
		
		<!-- Navigation items -->
		{#each items as item}
			<button
				bind:this={itemElements[item.id]}
				class="nav-item {visuallyActiveItem === item.id ? 'active' : ''}"
				onclick={() => handleItemClick(item.id, item.href)}
			>
				{item.label}
			</button>
		{/each}
	</div>
</nav>

<style>
	.navbar {
		display: flex;
		justify-content: flex-end;
		align-items: flex-end;
		padding: 1rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		margin-right: 2em;
		position: sticky;
	}

	.navbar-container {
		display: flex;
		background: #2a2a2a;
		border-radius: 25px;
		padding: 6px;
		gap: 4px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.selector {
		position: absolute;
		top: 6px;
		left: 6px;
		height: calc(100% - 12px);
		background: #dc2626;
		border-radius: 20px;
		transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
		z-index: 1;
		box-shadow: 0 2px 10px rgba(220, 38, 38, 0.3);
	}

	.nav-item {
		position: relative;
		z-index: 2;
		background: none;
		border: none;
		color: #ffffff;
		padding: 10px 15px;
		border-radius: 20px;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		min-width: fit-content;
	}

	.nav-item:hover {
		color: #ffffff;
		transform: translateY(-1px);
	}

	.nav-item.active {
		color: #ffffff;
	}

	.nav-item:focus {
		outline: none;
	}

	/* Add subtle glow effect */
	.navbar-container::before {
		content: '';
		position: absolute;
		inset: -1px;
		background: linear-gradient(45deg, rgba(220, 38, 38, 0.1), transparent, rgba(220, 38, 38, 0.1));
		border-radius: 25px;
		z-index: -1;
	}

	/* Enhanced animations for liquid glass effect */
	@keyframes bounce-in {
		0% {
			transform: translateX(var(--target-x, 0)) scale(0.8);
		}
		50% {
			transform: translateX(var(--target-x, 0)) scale(1.05);
		}
		100% {
			transform: translateX(var(--target-x, 0)) scale(1);
		}
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.navbar-container {
			gap: 2px;
			padding: 4px;
		}
		
		.nav-item {
			padding: 10px 16px;
			font-size: 13px;
		}
		
		.selector {
			top: 4px;
			left: 4px;
			height: calc(100% - 8px);
		}
	}

	@media (max-width: 480px) {
		.nav-item {
			padding: 8px 12px;
			font-size: 12px;
		}
	}
</style>