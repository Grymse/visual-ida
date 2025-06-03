<script lang="ts">
	import { onMount } from 'svelte';

	let videoElement: HTMLVideoElement;
	let canvasElement: HTMLCanvasElement;
	let errorMessage: string | null = null;
	let isLoading = true;
	let showFilters = false;
	let activeFilters: string[] = [];
	let motionDetectionActive = false;
	let radialFocusActive = false;
	let animationFrameId: number;
	let previousImageData: ImageData | null = null;
	let frameBuffer: ImageData[] = []; // Buffer to store multiple frames for averaging
	let motionPersistenceBuffer: number[] = []; // Buffer to store motion intensity for persistence
	let motionDecayRate = 0.2; // How fast motion fades (0.85 = retains 85% each frame)

	onMount(async () => {
		console.log('Starting camera initialization...');

		try {
			// Check if getUserMedia is available
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('getUserMedia is not supported in this browser');
			}

			console.log('Requesting camera access...');
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1920 },
					height: { ideal: 1080 },
					facingMode: 'user'
				}
			});

			console.log('Camera access granted, setting up video element...');
			isLoading = false;
			if (videoElement) {
				videoElement.srcObject = stream;
				// Don't set isLoading = false here, wait for the video to actually load
				await videoElement.play();
			}
		} catch (error) {
			console.error('Error accessing camera:', error);
			if (error instanceof Error) {
				errorMessage = `Camera access error: ${error.message}`;
			} else {
				errorMessage =
					'Failed to access camera. Please ensure you have granted camera permissions.';
			}
			isLoading = false;
		}
	});

	function handleVideoLoad() {
		console.log('Video loaded and ready to play');
		isLoading = false;
	}

	function handleVideoPlay() {
		console.log('Video started playing');
		isLoading = false;
	}

	// Filter definitions
	const filters = [
		{ id: 'invert', name: 'Invert Colors', css: 'invert(1)' },
		{ id: 'red-tone', name: 'Red Tone', css: 'sepia(1) hue-rotate(0deg) saturate(2)' },
		{ id: 'blue-tone', name: 'Blue Tone', css: 'sepia(1) hue-rotate(180deg) saturate(2)' },
		{ id: 'green-tone', name: 'Green Tone', css: 'sepia(1) hue-rotate(90deg) saturate(2)' },
		{ id: 'grayscale', name: 'Grayscale', css: 'grayscale(1)' },
		{ id: 'sepia', name: 'Sepia', css: 'sepia(1)' },
		{ id: 'blur', name: 'Blur', css: 'blur(2px)' },
		{ id: 'contrast', name: 'High Contrast', css: 'contrast(2)' },
		{ id: 'brightness', name: 'Bright', css: 'brightness(1.5)' },
		{ id: 'vintage', name: 'Vintage', css: 'sepia(0.8) contrast(1.2) brightness(1.1)' },
		{ id: 'neon', name: 'Neon', css: 'saturate(2) brightness(1.2) contrast(1.5)' },
		{ id: 'radial-focus', name: 'Radial Focus', css: '', isSpecial: true },
		{ id: 'motion-detection', name: 'Motion Detection', css: '', isSpecial: true }
	];

	function toggleFilter(filterId: string) {
		if (filterId === 'motion-detection') {
			if (motionDetectionActive) {
				stopMotionDetection();
			} else {
				startMotionDetection();
			}
			return;
		}

		if (filterId === 'radial-focus') {
			radialFocusActive = !radialFocusActive;
			return;
		}

		if (activeFilters.includes(filterId)) {
			activeFilters = activeFilters.filter((f) => f !== filterId);
		} else {
			activeFilters = [...activeFilters, filterId];
		}
	}

	function startMotionDetection() {
		if (!videoElement || !canvasElement) return;

		motionDetectionActive = true;
		previousImageData = null;
		frameBuffer = []; // Reset frame buffer
		motionPersistenceBuffer = []; // Reset motion persistence buffer

		const ctx = canvasElement.getContext('2d');
		if (!ctx) return;

		// Set canvas size to match video
		canvasElement.width = videoElement.videoWidth;
		canvasElement.height = videoElement.videoHeight;

		// Initialize motion persistence buffer
		const bufferSize = canvasElement.width * canvasElement.height;
		motionPersistenceBuffer = Array.from({ length: bufferSize }, () => 0);

		function processFrame() {
			if (!motionDetectionActive || !ctx) return;

			// Draw current video frame to canvas
			ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
			const currentImageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);

			// Add current frame to buffer
			frameBuffer.push(currentImageData);

			// Keep only last 3 frames for smoothing
			if (frameBuffer.length > 3) {
				frameBuffer.shift();
			}

			// Only start processing after we have at least 2 frames
			if (frameBuffer.length >= 2) {
				// Use the frame from 2 frames ago for more stable comparison
				const compareFrame = frameBuffer[frameBuffer.length - 2];

				// Calculate difference between current and comparison frame
				const diffImageData = ctx.createImageData(canvasElement.width, canvasElement.height);

				// Pre-calculate canvas dimensions and constants
				const width = canvasElement.width;
				const height = canvasElement.height;
				const centerX = width / 2;
				const centerY = height / 2;
				const maxRadiusSquared = centerX * centerX + centerY * centerY;
				const invMaxRadius = 1 / Math.sqrt(maxRadiusSquared);

				// Process pixels with optimized calculations
				const currentData = currentImageData.data;
				const compareData = compareFrame.data;
				const diffData = diffImageData.data;

				// Temporary buffer for current frame's motion
				const currentMotion = Array.from({ length: width * height }, () => 0);

				for (let y = 0; y < height; y++) {
					const dySquared = (y - centerY) * (y - centerY);

					for (let x = 0; x < width; x++) {
						const pixelIndex = y * width + x;
						const i = pixelIndex * 4;

						// Optimized distance calculation
						const dxSquared = (x - centerX) * (x - centerX);
						const distanceSquared = dxSquared + dySquared;
						const normalizedDistance = Math.sqrt(distanceSquared) * invMaxRadius;

						// Create radial sensitivity mask - high sensitivity in center, low at edges
						const radialSensitivity = Math.max(0.1, 1 - normalizedDistance * 0.9);

						// Calculate the difference for RGB channels (optimized)
						const rDiff = Math.abs(currentData[i] - compareData[i]);
						const gDiff = Math.abs(currentData[i + 1] - compareData[i + 1]);
						const bDiff = Math.abs(currentData[i + 2] - compareData[i + 2]);

						// Use the average difference
						const avgDiff = (rDiff + gDiff + bDiff) * 0.33333;

						// Apply radial weighting to the difference
						const radialWeightedDiff = avgDiff * radialSensitivity;

						// Apply adaptive threshold based on distance from center
						const adaptiveThreshold = 30 + normalizedDistance * 40;
						const filteredDiff = radialWeightedDiff > adaptiveThreshold ? radialWeightedDiff : 0;

						// Enhanced motion detection with radial focus
						const enhancedDiff = Math.min(255, filteredDiff * (1.5 + radialSensitivity * 0.5));

						// Store current motion for this pixel
						currentMotion[pixelIndex] = enhancedDiff;

						// Apply persistence: combine current motion with decaying previous motion
						const persistedMotion = Math.max(
							enhancedDiff,
							motionPersistenceBuffer[pixelIndex] * motionDecayRate
						);

						// Update persistence buffer
						motionPersistenceBuffer[pixelIndex] = persistedMotion;

						// Apply temporal smoothing to reduce jitter
						const smoothedMotion = Math.min(255, persistedMotion);

						// Set the difference as grayscale
						diffData[i] = smoothedMotion;
						diffData[i + 1] = smoothedMotion;
						diffData[i + 2] = smoothedMotion;
						diffData[i + 3] = 255;
					}
				}

				// Display the difference image
				ctx.putImageData(diffImageData, 0, 0);

				// Apply radial focus overlay to the canvas if radial focus is active
				if (radialFocusActive) {
					applyRadialFocusToCanvas(ctx);
				}
			}

			animationFrameId = requestAnimationFrame(processFrame);
		}

		processFrame();
	}

	function applyRadialFocusToCanvas(ctx: CanvasRenderingContext2D) {
		// Create a radial gradient overlay directly on the canvas
		const width = canvasElement.width;
		const height = canvasElement.height;
		const centerX = width / 2;
		const centerY = height / 2;
		const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

		// Create gradient
		const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
		gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Transparent center
		gradient.addColorStop(0.2, 'rgba(0, 0, 0, 0)'); // Still transparent at 20%
		gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)'); // 25% opacity at 50%
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)'); // 50% opacity at edges

		// Apply the gradient overlay
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	}

	function stopMotionDetection() {
		motionDetectionActive = false;
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		previousImageData = null;
		motionPersistenceBuffer = []; // Clear persistence buffer
	}

	function clearAllFilters() {
		activeFilters = [];
	}

	function toggleFiltersPanel() {
		showFilters = !showFilters;
	}

	// Generate the CSS filter string based on active filters
	$: filterStyle =
		activeFilters.length > 0
			? activeFilters.map((id) => filters.find((f) => f.id === id)?.css).join(' ')
			: 'none';

	// Show canvas when motion detection is active, otherwise show video
	$: showCanvas = motionDetectionActive;
</script>

<svelte:head>
	<title>Camera Feed</title>
</svelte:head>

{#if isLoading}
	<div class="loading">
		<p>Loading camera...</p>
	</div>
{:else if errorMessage}
	<div class="error">
		<p>{errorMessage}</p>
	</div>
{/if}
<!-- svelte-ignore a11y-media-has-caption -->
<video
	bind:this={videoElement}
	autoplay
	muted
	playsinline
	on:loadeddata={handleVideoLoad}
	on:playing={handleVideoPlay}
	class="camera-feed"
	style="filter: {filterStyle}; transform: scaleX(-1); display: {showCanvas ? 'none' : 'block'};"
></video>

<!-- Canvas for motion detection -->
<canvas
	bind:this={canvasElement}
	class="camera-feed"
	style="filter: {filterStyle}; display: {showCanvas ? 'block' : 'none'};"
></canvas>

<!-- Filter Controls -->
<div class="filter-controls">
	<button class="filter-toggle" on:click={toggleFiltersPanel}> 🎨 Filters </button>

	{#if showFilters}
		<div class="filters-panel">
			<div class="filters-header">
				<h3>Camera Filters</h3>
				<button class="clear-all" on:click={clearAllFilters}>Clear All</button>
			</div>

			<div class="filters-grid">
				{#each filters as filter}
					<button
						class="filter-button {activeFilters.includes(filter.id) ? 'active' : ''} {filter.id ===
							'motion-detection' && motionDetectionActive
							? 'motion-active'
							: ''} {filter.id === 'radial-focus' && radialFocusActive ? 'radial-active' : ''}"
						on:click={() => toggleFilter(filter.id)}
					>
						{filter.name}
					</button>
				{/each}
			</div>

			{#if activeFilters.length > 0}
				<div class="active-filters">
					<p>
						Active: {activeFilters.map((id) => filters.find((f) => f.id === id)?.name).join(', ')}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		height: 100vh;
		width: 100vw;
	}

	:global(#svelte) {
		height: 100vh;
		width: 100vw;
	}

	.camera-feed {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		object-fit: cover;
		z-index: 1;
	}

	.filter-controls {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 10;
	}

	.filter-toggle {
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		padding: 12px 20px;
		border-radius: 25px;
		cursor: pointer;
		font-size: 16px;
		backdrop-filter: blur(10px);
		transition: all 0.3s ease;
	}

	.filter-toggle:hover {
		background: rgba(0, 0, 0, 0.9);
		transform: scale(1.05);
	}

	.filters-panel {
		position: absolute;
		top: 60px;
		right: 0;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(20px);
		border-radius: 15px;
		padding: 20px;
		min-width: 300px;
		max-width: 400px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.filters-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
		color: white;
	}

	.filters-header h3 {
		margin: 0;
		font-size: 18px;
	}

	.clear-all {
		background: rgba(220, 53, 69, 0.8);
		color: white;
		border: none;
		padding: 6px 12px;
		border-radius: 15px;
		cursor: pointer;
		font-size: 12px;
		transition: background 0.3s ease;
	}

	.clear-all:hover {
		background: rgba(220, 53, 69, 1);
	}

	.filters-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		margin-bottom: 15px;
	}

	.filter-button {
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 10px 12px;
		border-radius: 10px;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.3s ease;
		text-align: center;
	}

	.filter-button:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: translateY(-2px);
	}

	.filter-button.active {
		background: rgba(74, 144, 226, 0.8);
		border-color: rgba(74, 144, 226, 1);
		box-shadow: 0 0 10px rgba(74, 144, 226, 0.5);
	}

	.filter-button.motion-active {
		background: rgba(255, 165, 0, 0.8);
		border-color: rgba(255, 165, 0, 1);
		box-shadow: 0 0 10px rgba(255, 165, 0, 0.5);
	}

	.filter-button.radial-active {
		background: rgba(147, 112, 219, 0.8);
		border-color: rgba(147, 112, 219, 1);
		box-shadow: 0 0 10px rgba(147, 112, 219, 0.5);
	}

	.radial-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		z-index: 5;
		background: radial-gradient(
			circle at center,
			transparent 20%,
			rgba(0, 0, 0, 0.25) 50%,
			rgba(0, 0, 0, 0.5) 100%
		);
	}

	.active-filters {
		color: rgba(255, 255, 255, 0.8);
		font-size: 12px;
		padding-top: 10px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.active-filters p {
		margin: 0;
	}

	.loading,
	.error {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 20px;
		border-radius: 8px;
		text-align: center;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		z-index: 2;
	}

	.error {
		background: rgba(139, 0, 0, 0.9);
	}
</style>
