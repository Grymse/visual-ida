<script lang="ts">
	import type MotionDetection from './MotionDetection.svelte';

	interface Props {
		motionDetection: MotionDetection;
	}

	let { motionDetection }: Props = $props();

	let maxComputeTime = $state(0);

	$effect(() => {
		if (motionDetection.state.computeTime) {
			maxComputeTime = Math.max(maxComputeTime, motionDetection.state.computeTime);
		}
	});
</script>

<p class="fps-counter">
	{motionDetection.state.fps}
	{motionDetection.state.computeTime}ms
	<span class="max-time">{maxComputeTime}ms</span>
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
	}

	.max-time {
		color: red;
	}
</style>
