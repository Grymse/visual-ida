<script lang="ts">
	import { onMount } from 'svelte';
	import FilterControls from '$lib/FilterControls.svelte';
	import { filters } from '$lib/filters';
	import MotionDetection from '$lib/MotionDetection.svelte';

	let videoElement: HTMLVideoElement;
	let canvasElement: HTMLCanvasElement;
	let errorMessage: string | null = $state(null);
	let isLoading = $state(true);
	let activeFilters: string[] = $state(['blue-tone', 'neon']);
	let radialFocusActive = $state(false);
	let fps = 20; // Nice framerate for motion detection
	const motionDetection = new MotionDetection();

	// let motionDetectionError: string | null = $derived(motionDetection.state.errorMessage);

	let angleAnimationTimeout: ReturnType<typeof setTimeout> | null = null;
	let angleAnimationFrame: number | null = null;
	let angleAnimationStart = 0;
	let angleAnimationDuration = 0;
	let angleAnimationFrom = motionDetection.options.movementAngle;
	let angleAnimationTo = motionDetection.options.movementAngle;

	function animateAngleChange() {
		// Animate movementAngle from angleAnimationFrom to angleAnimationTo over angleAnimationDuration ms
		const now = performance.now();
		const elapsed = now - angleAnimationStart;
		const t = Math.min(elapsed / angleAnimationDuration, 1);
		const currentAngle = angleAnimationFrom + (angleAnimationTo - angleAnimationFrom) * t;
		// Update the motion detection angle
		motionDetection.options.movementAngle = currentAngle;

		if (t < 1) {
			angleAnimationFrame = requestAnimationFrame(animateAngleChange);
		} else {
			motionDetection.options.movementAngle = angleAnimationTo;
			angleAnimationFrame = null;
			scheduleNextAngleChange();
		}
	}

	function scheduleNextAngleChange() {
		const delay = 5000 + Math.random() * 15000; // 5-20 seconds
		angleAnimationTimeout = setTimeout(() => {
			angleAnimationFrom = motionDetection.options.movementAngle;
			angleAnimationTo = Math.floor(Math.random() * 361);
			angleAnimationStart = performance.now();
			angleAnimationDuration = 1500 + Math.random() * 1500; // 1.5-3s transition
			if (angleAnimationFrame) cancelAnimationFrame(angleAnimationFrame);
			angleAnimationFrame = requestAnimationFrame(animateAngleChange);
		}, delay);
	}

	// Start the angle animation loop on mount
	onMount(() => {
		scheduleNextAngleChange();
		return () => {
			if (angleAnimationTimeout) clearTimeout(angleAnimationTimeout);
			if (angleAnimationFrame) cancelAnimationFrame(angleAnimationFrame);
		};
	});

	setTimeout(() => {
		motionDetection.start(videoElement, canvasElement);
	}, 1000);

	onMount(() => {
		initializeCamera();
	});

	async function initializeCamera() {
		await motionDetection.setupWasm();
		console.log('Starting camera initialization...');

		try {
			// Check if getUserMedia is available
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('getUserMedia is not supported in this browser');
			}

			console.log('Requesting camera access...');
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: 'user',
					frameRate: 30
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

		// Cleanup function
		return () => {
			if (angleAnimationTimeout) clearTimeout(angleAnimationTimeout);
			if (angleAnimationFrame) cancelAnimationFrame(angleAnimationFrame);
			motionDetection.destroy();
		};
	}

	function handleVideoLoad() {
		console.log('Video loaded and ready to play!');
		isLoading = false;
	}

	function handleVideoPlay() {
		console.log('Video started playing');
		isLoading = false;
	}

	// Filter control functions
	function toggleFilter(filterId: string) {
		if (filterId === 'motion-detection') {
			if (motionDetection.state.isActive) {
				motionDetection.stop();
			} else {
				motionDetection.start(videoElement, canvasElement);
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

	function filtersToCSS(fi: string[]) {
		return fi.length > 0 ? fi.map((id) => filters.find((f) => f.id === id)?.css).join(' ') : 'none';
	}

	$effect(() => {
		return () => {
			if (motionDetection.state.isActive) {
				motionDetection.stop();
			}
		};
	});

	let maxComputeTime = $state(0);

	$effect(() => {
		if (motionDetection.state.computeTime) {
			maxComputeTime = Math.max(maxComputeTime, motionDetection.state.computeTime);
		}
	});
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
	onloadeddata={handleVideoLoad}
	onplaying={handleVideoPlay}
	class="camera-feed"
	style="display: {motionDetection.state.isActive ? 'none' : 'block'};"
></video>

<!-- Canvas for motion detection -->
<canvas
	bind:this={canvasElement}
	class="camera-feed"
	style="filter: {filtersToCSS(activeFilters)}; display: {motionDetection.state.isActive
		? 'block'
		: 'none'};"
></canvas>

<p style="position: absolute; color: yellow; top: 20px; left: 20px; z-index: 100;">
	{motionDetection.state.fps}
	{motionDetection.state.computeTime}ms
	<span style="color: red;">{maxComputeTime}</span>
</p>

<FilterControls
	bind:activeFilters
	motionDetectionActive={motionDetection.state.isActive}
	bind:radialFocusActive
	movementAngle={motionDetection.options.movementAngle}
	movementSpeed={motionDetection.options.movementSpeed}
	motionDecayRate={motionDetection.options.motionDecayRate}
	motionThreshold={motionDetection.options.motionThreshold}
	motionSensitivity={motionDetection.options.motionSensitivity}
	onToggleFilter={toggleFilter}
	motionDetectionOptions={motionDetection.options}
/>

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
