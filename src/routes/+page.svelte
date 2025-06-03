<script lang="ts">
	import { onMount } from 'svelte';

	let videoElement: HTMLVideoElement;
	let canvasElement: HTMLCanvasElement;
	let errorMessage: string | null = null;
	let isLoading = true;
	let showFilters = false;
	let activeFilters: string[] = ['blue-tone', 'neon'];
	let motionDetectionActive = false;
	let radialFocusActive = false;
	let animationFrameId: number;
	let previousImageData: ImageData | null = null;
	let frameBuffer: ImageData[] = []; // Buffer to store multiple frames for averaging
	let motionPersistenceBuffer: number[] = []; // Buffer to store motion intensity for persistence
	let motionDecayRate = 0.8; // How fast motion fades (0.85 = retains 85% each frame)

	// WebAssembly imports
	let MotionDetector: any = null;
	let motionDetector: any = null;
	let useWasm = false;

	setTimeout(() => {
		startMotionDetection();
	}, 200);

	onMount(async () => {
		// Check if WebAssembly module was loaded globally
		const checkWasm = () => {
			if ((window as any).wasmLoaded && (window as any).WasmMotionDetector) {
				MotionDetector = (window as any).WasmMotionDetector;
				useWasm = true;
				console.log('✅ Using globally loaded WebAssembly module');
				return true;
			}
			return false;
		};

		// Try to get WASM immediately, or wait for it to load
		if (!checkWasm()) {
			// Wait up to 2 seconds for WASM to load
			let attempts = 0;
			const maxAttempts = 20;
			const interval = setInterval(() => {
				attempts++;
				if (checkWasm() || attempts >= maxAttempts) {
					clearInterval(interval);
					if (!useWasm) {
						console.warn('⚠️ WebAssembly module not available, using JavaScript fallback');
					}
				}
			}, 100);
		}
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
					facingMode: 'user',
					frameRate: 15
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
		{ id: 'blur', name: 'Blur', css: 'blur(1px)' },
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

		// Initialize WebAssembly motion detector if available
		if (useWasm && MotionDetector) {
			try {
				motionDetector = new MotionDetector(canvasElement.width, canvasElement.height);
				console.log('🚀 Using WebAssembly motion detection');
			} catch (error) {
				console.warn('Failed to initialize WASM motion detector:', error);
				useWasm = false;
				motionDetector = null;
			}
		}

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

				// Use WebAssembly motion detection
				if (useWasm && motionDetector) {
					try {
						motionDetector.process_motion(
							currentImageData.data,
							compareFrame.data,
							diffImageData.data,
							motionDecayRate
						);
					} catch (error) {
						console.warn('WASM motion detection failed:', error);
						// Fall back to clearing the image if WASM fails
						diffImageData.data.fill(0);
					}
				} else {
					// No WebAssembly available - clear the image
					diffImageData.data.fill(0);
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

		// Clean up WASM resources
		if (motionDetector) {
			try {
				motionDetector.free();
			} catch (error) {
				console.warn('Error freeing WASM motion detector:', error);
			}
			motionDetector = null;
		}
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

			{#if motionDetectionActive}
				<div class="performance-status {useWasm ? 'wasm-enabled' : 'js-fallback'}">
					<p>Motion Detection: {useWasm ? '🚀 WebAssembly' : '⚡ JavaScript'}</p>
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

	.active-filters {
		color: rgba(255, 255, 255, 0.8);
		font-size: 12px;
		padding-top: 10px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.active-filters p {
		margin: 0;
	}

	.performance-status {
		color: rgba(255, 255, 255, 0.9);
		font-size: 12px;
		padding-top: 10px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		text-align: center;
	}

	.performance-status.wasm-enabled {
		color: #4ade80; /* Green for WebAssembly */
	}

	.performance-status.js-fallback {
		color: #fb923c; /* Orange for JavaScript fallback */
	}

	.performance-status p {
		margin: 0;
		font-weight: 500;
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
