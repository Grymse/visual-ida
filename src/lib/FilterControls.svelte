<script lang="ts">
	import { filters } from './filters';
	import type { MotionDetectionOptions } from './MotionDetection.svelte';

	// Filter definitions

	interface Props {
		activeFilters: string[];
		motionDetectionActive: boolean;
		radialFocusActive: boolean;
		movementAngle: number;
		movementSpeed: number;
		motionDecayRate: number;
		motionThreshold: number;
		motionSensitivity: number;
		onToggleFilter: (filterId: string) => void;
		motionDetectionOptions: MotionDetectionOptions;
	}

	let {
		activeFilters = $bindable(),
		motionDetectionActive = $bindable(),
		radialFocusActive = $bindable(),
		movementAngle,
		movementSpeed,
		motionDecayRate,
		motionThreshold,
		motionSensitivity,
		onToggleFilter,
		motionDetectionOptions = $bindable<MotionDetectionOptions>()
	}: Props = $props();

	let showFilters = $state(false);

	function toggleFiltersPanel() {
		showFilters = !showFilters;
	}

	function handleToggleFilter(filterId: string) {
		onToggleFilter(filterId);
	}

	function handleClearAll() {
		activeFilters = [];
	}

	function handleMovementAngleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.movementAngle = parseInt(target.value);
	}

	function handleMovementSpeedChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.movementSpeed = parseFloat(target.value);
	}

	function handleMotionDecayRateChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.motionDecayRate = parseFloat(target.value);
	}

	function handleMotionThresholdChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.motionThreshold = parseFloat(target.value);
	}

	function handleMotionSensitivityChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.motionSensitivity = parseFloat(target.value);
	}
</script>

<!-- Filter Controls -->
<div class="filter-controls">
	<button class="filter-toggle" onclick={toggleFiltersPanel}> 🎨 Filters </button>

	{#if showFilters}
		<div class="filters-panel">
			<div class="filters-header">
				<h3>Camera Filters</h3>
				<button class="clear-all" onclick={handleClearAll}>Clear All</button>
			</div>

			<div class="filters-grid">
				{#each filters as filter}
					<button
						class="filter-button {activeFilters.includes(filter.id) ? 'active' : ''} {filter.id ===
							'motion-detection' && motionDetectionActive
							? 'motion-active'
							: ''} {filter.id === 'radial-focus' && radialFocusActive ? 'radial-active' : ''}"
						onclick={() => handleToggleFilter(filter.id)}
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
				<div class="motion-controls">
					<h4>Motion Movement</h4>
					<div class="control-group">
						<label for="movement-angle">Angle: {movementAngle}°</label>
						<input
							id="movement-angle"
							type="range"
							min="0"
							max="360"
							value={movementAngle}
							oninput={handleMovementAngleChange}
							class="slider"
						/>
					</div>
					<div class="control-group">
						<label for="movement-speed">Speed: {movementSpeed.toFixed(1)}</label>
						<input
							id="movement-speed"
							type="range"
							min="0"
							max="100"
							step="1"
							value={movementSpeed}
							oninput={handleMovementSpeedChange}
							class="slider"
						/>
					</div>

					<h4>Motion Detection</h4>
					<div class="control-group">
						<label for="motion-decay">Decay Rate: {motionDecayRate.toFixed(2)}</label>
						<input
							id="motion-decay"
							type="range"
							min="0.1"
							max="0.99"
							step="0.01"
							value={motionDecayRate}
							oninput={handleMotionDecayRateChange}
							class="slider"
						/>
					</div>
					<div class="control-group">
						<label for="motion-threshold">Threshold: {motionThreshold.toFixed(0)}</label>
						<input
							id="motion-threshold"
							type="range"
							min="1"
							max="100"
							step="1"
							value={motionThreshold}
							oninput={handleMotionThresholdChange}
							class="slider"
						/>
					</div>
					<!-- <div class="control-group">
						<label for="motion-sensitivity">Sensitivity: {motionSensitivity.toFixed(1)}</label>
						<input
							id="motion-sensitivity"
							type="range"
							min="0.5"
							max="5.0"
							step="0.1"
							value={motionSensitivity}
							oninput={handleMotionSensitivityChange}
							class="slider"
						/>
					</div> -->
				</div>
			{/if}

			{#if motionDetectionActive}
				<div class="performance-status wasm-enabled">
					<p>Motion Detection: 🚀 WebAssembly</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
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

	.motion-controls {
		margin-top: 15px;
		padding-top: 15px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.motion-controls h4 {
		margin: 0 0 10px 0;
		color: rgba(255, 255, 255, 0.9);
		font-size: 14px;
	}

	.control-group {
		margin-bottom: 10px;
	}

	.control-group label {
		display: block;
		color: rgba(255, 255, 255, 0.8);
		font-size: 12px;
		margin-bottom: 5px;
	}

	.slider {
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.2);
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: rgba(74, 144, 226, 1);
		cursor: pointer;
		box-shadow: 0 0 5px rgba(74, 144, 226, 0.5);
	}

	.slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: rgba(74, 144, 226, 1);
		cursor: pointer;
		border: none;
		box-shadow: 0 0 5px rgba(74, 144, 226, 0.5);
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

	.performance-status p {
		margin: 0;
		font-weight: 500;
	}
</style>
