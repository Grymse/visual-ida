<script lang="ts">
	import { onMount } from 'svelte';
	import MotionDetectionControls from '$lib/MotionDetectionControls.svelte';
	import FpsCounter from '$lib/FpsCounter.svelte';
	import PresetControls from '$lib/PresetControls.svelte';
	import MotionDetection from '$lib/MotionDetection.svelte';
	import AutoHideUI from '$lib/AutoHideUI.svelte';
	import { AnimateAngleChange } from '$lib/AnimateAngleChange.svelte';
	import { ColorFilters } from '$lib/ColorFilters.svelte';
	import { PresetManager } from '$lib/presets/PresetManager.svelte';
	import type { MotionDetectionOptions } from '$lib/MotionDetection.svelte';

	let videoElement: HTMLVideoElement;
	let canvasElement: HTMLCanvasElement;
	let errorMessage: string | null = $state(null);
	let isLoading = $state(true);
	let startOn = true;
	const motionDetection = new MotionDetection();
	const colorFilters = new ColorFilters();

	// Create preset manager with callback to update motion detection options
	const presetManager = new PresetManager(
		(options: MotionDetectionOptions) => {
			// Update motion detection options when a preset is applied
			Object.assign(motionDetection.options, options);
		},
		() => {
			// Return current motion detection options for smooth transitions
			return motionDetection.options;
		},
		(colorInterval: number) => {
			// Update color interval duration
			colorFilters.intervalDuration = colorInterval;
			// Restart the color filter with new interval if it's running
			if (colorFilters.isActive()) {
				colorFilters.start();
			}
		}
	);

	// Add reorderPresets method if it doesn't exist
	if (!presetManager.reorderPresets) {
		presetManager.reorderPresets = function (fromIndex: number, toIndex: number) {
			if (fromIndex === toIndex) return;

			const presetsCopy = [...this.presets];
			const [movedPreset] = presetsCopy.splice(fromIndex, 1);
			presetsCopy.splice(toIndex, 0, movedPreset);

			this.presets = presetsCopy;
		};
	}

	// Watch for changes in motion options to detect unsaved changes
	$effect(() => {
		// Use the proper tolerance-based unsaved changes detection
		presetManager.checkForUnsavedChanges(motionDetection.options);
	});

	let maxComputeTime = $state(0);

	const angleAnimation = new AnimateAngleChange((angle) => {
		motionDetection.options.movementAngle = angle;
	});

	// Start the angle animation loop on mount
	onMount(() => {
		angleAnimation.start(motionDetection.options.movementAngle);
		colorFilters.start();

		// Auto-start cycling if presets are available
		setTimeout(() => {
			if (presetManager.presets.length > 0) {
				presetManager.startCycling();
			}
		}, 1000); // Wait 1 second for everything to initialize

		return () => {
			angleAnimation.destroy();
			colorFilters.destroy();
			presetManager.destroy();
		};
	});

	onMount(() => {
		initializeCamera();
	});

	async function initializeCamera() {
		await motionDetection.setupWasm();
		await motionDetection.waitForWasm();
		if (startOn) motionDetection.start(videoElement, canvasElement);

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

	// Function to create a new preset from current settings
	function createPresetFromCurrentSettings(name: string) {
		presetManager.createPreset(name, motionDetection.options);
	}

	// Track max compute time
	$effect(() => {
		if (motionDetection.state.computeTime) {
			maxComputeTime = Math.max(maxComputeTime, motionDetection.state.computeTime);
		}
	});

	$effect(() => {
		return () => {
			if (motionDetection.state.isActive) {
				motionDetection.stop();
			}
		};
	});
</script>

<svelte:head>
	<title>Psychedelic Visualization</title>
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
	style="filter: {colorFilters.filters}; transition-duration: {colorFilters.intervalDuration}ms; display: {motionDetection
		.state.isActive
		? 'block'
		: 'none'};"
></canvas>

<AutoHideUI hideAfterMs={10000}>
	<FpsCounter {motionDetection} />

	<PresetControls
		{presetManager}
		onCreatePreset={createPresetFromCurrentSettings}
		currentMotionOptions={motionDetection.options}
	/>

	<MotionDetectionControls
		isMotionDetectionActive={motionDetection.state.isActive}
		{toggleMotionDetection}
		motionDetectionOptions={motionDetection.options}
		{presetManager}
	/>
</AutoHideUI>

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
