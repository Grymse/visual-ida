<script lang="ts">
	import { onMount } from 'svelte';
	import FilterControls from '$lib/FilterControls.svelte';
	import MotionDetection from '$lib/MotionDetection.svelte';
	import { AnimateAngleChange } from '$lib/AnimateAngleChange.svelte';
	import { ColorFilters } from '$lib/ColorFilters.svelte';

	let videoElement: HTMLVideoElement;
	let canvasElement: HTMLCanvasElement;
	let errorMessage: string | null = $state(null);
	let isLoading = $state(true);
	const motionDetection = new MotionDetection();
	const colorFilters = new ColorFilters();

	const angleAnimation = new AnimateAngleChange((angle) => {
		motionDetection.options.movementAngle = angle;
	});

	// Start the angle animation loop on mount
	onMount(() => {
		angleAnimation.start(motionDetection.options.movementAngle);
		colorFilters.start();
		return () => {
			angleAnimation.destroy();
			colorFilters.destroy();
		};
	});

	onMount(() => {
		initializeCamera();
	});

	async function initializeCamera() {
		await motionDetection.setupWasm();
		await motionDetection.waitForWasm();
		motionDetection.start(videoElement, canvasElement);

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
			if (videoElement) {
				videoElement.srcObject = stream;
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
	function toggleMotionDetection() {
		if (motionDetection.state.isActive) {
			motionDetection.stop();
		} else {
			motionDetection.start(videoElement, canvasElement);
		}
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
	<title>Psychic Visualization</title>
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
	style="filter: {colorFilters.filters}; transition-duration: {colorFilters.transitionDuration}ms; display: {motionDetection
		.state.isActive
		? 'block'
		: 'none'};"
></canvas>

<p style="position: absolute; color: yellow; top: 20px; left: 20px; z-index: 100;">
	{motionDetection.state.fps}
	{motionDetection.state.computeTime}ms
	<span style="color: red;">{maxComputeTime}</span>
</p>

<FilterControls
	isMotionDetectionActive={motionDetection.state.isActive}
	{toggleMotionDetection}
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
