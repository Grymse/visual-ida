<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		children: import('svelte').Snippet;
		hideAfterMs?: number;
		startHidden?: boolean;
	}

	let { children, hideAfterMs = 10000, startHidden = false }: Props = $props();

	let isUIVisible = $state(!startHidden);
	let timeoutId: number | null = null;

	function resetHideTimer() {
		// Clear existing timeout
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}

		// Show UI immediately
		isUIVisible = true;

		// Set new timeout to hide UI
		timeoutId = setTimeout(() => {
			isUIVisible = false;
		}, hideAfterMs);
	}

	function handleMouseMove() {
		resetHideTimer();
	}

	function handleKeyPress() {
		resetHideTimer();
	}

	function handleClick() {
		resetHideTimer();
	}

	function handleTouchStart() {
		resetHideTimer();
	}

	onMount(() => {
		// Start the timer immediately
		if (!startHidden) resetHideTimer();

		// Add event listeners for user activity
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('keydown', handleKeyPress);
		window.addEventListener('click', handleClick);
		window.addEventListener('touchstart', handleTouchStart);

		// Cleanup event listeners
		return () => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('keydown', handleKeyPress);
			window.removeEventListener('click', handleClick);
			window.removeEventListener('touchstart', handleTouchStart);
		};
	});
</script>

<div class="auto-hide-container" class:ui-hidden={!isUIVisible}>
	{@render children()}
</div>

<style>
	.auto-hide-container {
		height: 100vh;
		width: 100vw;
		position: relative;
	}

	/* Hide all UI elements except video and canvas when ui-hidden class is applied */
	.auto-hide-container.ui-hidden :global(*:not(video):not(canvas)) {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.5s ease-out;
	}

	/* Keep video and canvas always visible */
	.auto-hide-container :global(video),
	.auto-hide-container :global(canvas) {
		opacity: 1 !important;
		pointer-events: auto !important;
		transition: none !important;
	}

	/* Smooth transition for showing UI */
	.auto-hide-container :global(*:not(video):not(canvas)) {
		transition: opacity 0.3s ease-in;
	}

	/* Show cursor when UI is visible, hide when UI is hidden */
	.auto-hide-container {
		cursor: default;
		transition: cursor 0.3s ease;
	}

	.auto-hide-container.ui-hidden {
		cursor: none;
	}
</style>
