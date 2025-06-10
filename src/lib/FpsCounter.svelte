<script lang="ts">
	import type MotionDetection from './MotionDetection.svelte';

	interface Props {
		motionDetection: MotionDetection;
	}

	let { motionDetection }: Props = $props();

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

<p class="fps-counter">
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
