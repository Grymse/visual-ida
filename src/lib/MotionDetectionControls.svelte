<script lang="ts">
	import type { MotionDetectionOptions } from './MotionDetection.svelte';

	// Filter definitions

	interface Props {
		isMotionDetectionActive?: boolean;
		toggleMotionDetection?: () => void;
		motionDetectionOptions: MotionDetectionOptions;
	}

	let {
		isMotionDetectionActive = false,
		toggleMotionDetection = () => {},
		motionDetectionOptions = $bindable<MotionDetectionOptions>()
	}: Props = $props();

	let showFilters = $state(false);

	function toggleFiltersPanel() {
		showFilters = !showFilters;
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

	function handleMoveTypeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		motionDetectionOptions.moveType = target.value as 'direction' | 'radial' | 'spiral' | 'wave';
	}

	function handleRotationSpeedChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.rotationSpeed = parseFloat(target.value);
	}

	function handleWaveAmplitudeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.waveAmplitude = parseFloat(target.value);
	}

	function handleWaveFrequencyChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.waveFrequency = parseFloat(target.value);
	}

	function handleWavePhaseChange(event: Event) {
		const target = event.target as HTMLInputElement;
		motionDetectionOptions.wavePhase = parseFloat(target.value);
	}

	function handleWaveDirectionChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		motionDetectionOptions.waveDirection = parseInt(target.value) as 0 | 1;
	}
</script>

<!-- Filter Controls -->
<div class="filter-controls">
	<button class="filter-toggle" onclick={toggleFiltersPanel}> 🎨 Options </button>

	{#if showFilters}
		<div class="filters-panel">
			<button
				class="filter-button {isMotionDetectionActive ? 'active' : ''}"
				onclick={() => toggleMotionDetection()}
			>
				Motion Detection
			</button>

			{#if isMotionDetectionActive}
				<div class="motion-controls">
					<h4>Motion Movement</h4>

					<!-- Move Type Selector -->
					<div class="control-group">
						<label for="move-type">Effect Type:</label>
						<select
							id="move-type"
							value={motionDetectionOptions.moveType}
							onchange={handleMoveTypeChange}
							class="select-input"
						>
							<option value="direction">Directional</option>
							<option value="radial">Radial</option>
							<option value="spiral">Spiral</option>
							<option value="wave">Wave</option>
						</select>
					</div>

					<!-- Direction-specific controls -->
					{#if motionDetectionOptions.moveType === 'direction'}
						<div class="control-group">
							<label for="movement-angle">Angle: {motionDetectionOptions.movementAngle}°</label>
							<input
								id="movement-angle"
								type="range"
								min="0"
								max="360"
								value={motionDetectionOptions.movementAngle}
								oninput={handleMovementAngleChange}
								class="slider"
							/>
						</div>
					{/if}

					<!-- Speed control (common for direction, radial, spiral) -->
					{#if motionDetectionOptions.moveType !== 'wave'}
						<div class="control-group">
							<label for="movement-speed"
								>Speed: {motionDetectionOptions.movementSpeed.toFixed(1)}</label
							>
							<input
								id="movement-speed"
								type="range"
								min="-30"
								max="100"
								step="1"
								value={motionDetectionOptions.movementSpeed}
								oninput={handleMovementSpeedChange}
								class="slider"
							/>
						</div>
					{/if}

					<!-- Spiral-specific controls -->
					{#if motionDetectionOptions.moveType === 'spiral'}
						<div class="control-group">
							<label for="rotation-speed"
								>Rotation Speed: {motionDetectionOptions.rotationSpeed.toFixed(3)}</label
							>
							<input
								id="rotation-speed"
								type="range"
								min="-3.14"
								max="3.14"
								step="0.001"
								value={motionDetectionOptions.rotationSpeed}
								oninput={handleRotationSpeedChange}
								class="slider"
							/>
						</div>
					{/if}

					<!-- Wave-specific controls -->
					{#if motionDetectionOptions.moveType === 'wave'}
						<div class="control-group">
							<label for="wave-amplitude"
								>Amplitude: {motionDetectionOptions.waveAmplitude.toFixed(1)}</label
							>
							<input
								id="wave-amplitude"
								type="range"
								min="0"
								max="500"
								step="0.1"
								value={motionDetectionOptions.waveAmplitude}
								oninput={handleWaveAmplitudeChange}
								class="slider"
							/>
						</div>
						<div class="control-group">
							<label for="wave-frequency"
								>Frequency: {motionDetectionOptions.waveFrequency.toFixed(3)}</label
							>
							<input
								id="wave-frequency"
								type="range"
								min="0.001"
								max="2"
								step="0.001"
								value={motionDetectionOptions.waveFrequency}
								oninput={handleWaveFrequencyChange}
								class="slider"
							/>
						</div>
						<div class="control-group">
							<label for="wave-phase">Phase: {motionDetectionOptions.wavePhase.toFixed(2)}</label>
							<input
								id="wave-phase"
								type="range"
								min="0"
								max="6.28"
								step="0.01"
								value={motionDetectionOptions.wavePhase}
								oninput={handleWavePhaseChange}
								class="slider"
							/>
						</div>
						<div class="control-group">
							<label for="wave-direction">Direction:</label>
							<select
								id="wave-direction"
								value={motionDetectionOptions.waveDirection}
								onchange={handleWaveDirectionChange}
								class="select-input"
							>
								<option value="0">Horizontal</option>
								<option value="1">Vertical</option>
							</select>
						</div>
					{/if}

					<h4>Motion Detection</h4>
					<div class="control-group">
						<label for="motion-decay"
							>Decay Rate: {motionDetectionOptions.motionDecayRate.toFixed(2)}</label
						>
						<input
							id="motion-decay"
							type="range"
							min="0.1"
							max="0.99"
							step="0.01"
							value={motionDetectionOptions.motionDecayRate}
							oninput={handleMotionDecayRateChange}
							class="slider"
						/>
					</div>
					<div class="control-group">
						<label for="motion-threshold"
							>Threshold: {motionDetectionOptions.motionThreshold.toFixed(0)}</label
						>
						<input
							id="motion-threshold"
							type="range"
							min="1"
							max="100"
							step="1"
							value={motionDetectionOptions.motionThreshold}
							oninput={handleMotionThresholdChange}
							class="slider"
						/>
					</div>
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
		max-height: calc(100vh - 100px);
		overflow-y: auto;
	}

	/* Mobile and tablet responsiveness */
	@media (max-width: 768px) {
		.filter-controls {
			top: 10px;
			right: 10px;
			left: 10px;
		}

		.filter-toggle {
			width: 100%;
			padding: 10px 16px;
			font-size: 14px;
		}

		.filters-panel {
			position: fixed;
			top: 60px;
			left: 10px;
			right: 10px;
			min-width: unset;
			max-width: unset;
			padding: 15px;
			max-height: calc(100vh - 80px);
		}
	}

	@media (max-width: 480px) {
		.filter-controls {
			top: 5px;
			right: 5px;
			left: 5px;
		}

		.filters-panel {
			top: 50px;
			left: 5px;
			right: 5px;
			padding: 12px;
			border-radius: 10px;
			max-height: calc(100vh - 65px);
		}
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
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Mobile responsive grid */
	@media (max-width: 480px) {
		.filter-button {
			padding: 12px 16px;
			font-size: 16px;
			min-height: 48px;
		}
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

	/* Mobile responsive motion controls */
	@media (max-width: 480px) {
		.motion-controls h4 {
			font-size: 16px;
			margin-bottom: 12px;
		}

		.control-group {
			margin-bottom: 15px;
		}

		.control-group label {
			font-size: 14px;
			margin-bottom: 8px;
		}
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

	/* Mobile slider improvements */
	@media (max-width: 480px) {
		.slider {
			height: 6px;
			margin: 8px 0;
		}

		.slider::-webkit-slider-thumb {
			width: 20px;
			height: 20px;
		}

		.slider::-moz-range-thumb {
			width: 20px;
			height: 20px;
		}
	}

	.select-input {
		width: 100%;
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 8px 12px;
		border-radius: 8px;
		font-size: 14px;
		outline: none;
		transition: all 0.3s ease;
	}

	.select-input:focus {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(74, 144, 226, 0.8);
		box-shadow: 0 0 5px rgba(74, 144, 226, 0.3);
	}

	.select-input option {
		background: rgba(0, 0, 0, 0.9);
		color: white;
		padding: 8px;
	}

	/* Mobile responsive select inputs */
	@media (max-width: 480px) {
		.select-input {
			padding: 12px 16px;
			font-size: 16px;
			min-height: 44px;
		}
	}

	/* Touch improvements */
	@media (hover: none) and (pointer: coarse) {
		.filter-button:hover {
			transform: none;
		}

		.filter-toggle:hover {
			transform: none;
		}
	}
</style>
