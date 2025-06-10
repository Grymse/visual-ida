<script lang="ts">
	import type MotionDetection from './MotionDetection.svelte';

	interface Props {
		motionDetection: MotionDetection;
		isPresetMenuOpen?: boolean;
		isMotionMenuOpen?: boolean;
	}

	let { motionDetection, isPresetMenuOpen = false, isMotionMenuOpen = false }: Props = $props();

	let previousComputeTime = [] as number[];
	let maxComputeTime = $state(0);
	let averageComputeTime = $state('');

	$effect(() => {
		if (!motionDetection.state.computeTime) return;

		previousComputeTime.push(motionDetection.state.computeTime);
		if (previousComputeTime.length > 40) {
			previousComputeTime.shift();
		}

		maxComputeTime = Math.max(...previousComputeTime);
		averageComputeTime = (
			previousComputeTime.reduce((a, b) => a + b, 0) / previousComputeTime.length
		).toFixed(1);
	});
</script>

<p
	class="fps-counter"
	class:preset-menu-open={isPresetMenuOpen}
	class:motion-menu-open={isMotionMenuOpen}
>
	<span class="fps">FPS: {motionDetection.state.fps}</span>
	<span class="current-time">Current: {motionDetection.state.computeTime}ms</span>
	<span class="avg-time">
		Avg: {averageComputeTime}ms
	</span>
	<span class="max-time">Max: {maxComputeTime}ms</span>
</p>

<style>
	.fps-counter {
		position: absolute;
		color: yellow;
		bottom: 20px;
		left: 20px;
		z-index: 100;
		margin: 0;
		font-family: monospace;
		font-size: 14px;
		line-height: 1.4;
		transition: left 0.3s ease-in-out;
	}

	/* Move FPS counter to the right when preset menu is open */
	.fps-counter.preset-menu-open {
		left: 340px; /* 320px (preset menu width) + 20px margin */
	}

	/* Move FPS counter further right when both menus are open */
	.fps-counter.preset-menu-open.motion-menu-open {
		left: 360px; /* Account for both menus */
	}

	/* On mobile, adjust positioning */
	@media (max-width: 768px) {
		.fps-counter.preset-menu-open {
			left: 20px; /* Reset to original position on mobile since menus go full width */
			bottom: 80px; /* Move up instead */
		}

		.fps-counter.preset-menu-open.motion-menu-open {
			left: 20px;
			bottom: 140px; /* Move up further when both are open */
		}
	}

	.fps {
		color: cyan;
		display: block;
	}

	.current-time {
		color: yellow;
		display: block;
	}

	.avg-time {
		color: lightgreen;
		display: block;
	}

	.max-time {
		color: red;
		display: block;
	}
</style>
