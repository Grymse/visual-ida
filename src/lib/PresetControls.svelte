<script lang="ts">
	import type { MotionDetectionOptions } from './MotionDetection.svelte';
	import { PresetManager } from './presets/PresetManager.svelte';

	interface Props {
		presetManager: PresetManager;
		onCreatePreset: (name: string) => void;
		currentMotionOptions: MotionDetectionOptions;
	}

	let { presetManager, onCreatePreset, currentMotionOptions }: Props = $props();

	let newPresetName = $state('');
	let newPresetDescription = $state('');
	let showCreateDialog = $state(false);
	let showSettingsDialog = $state(false);

	// Inline editing state
	let editingPresetId = $state<string | null>(null);
	let editingPresetName = $state('');

	// Local state for settings
	let transitionDuration = $state(3000); // 3 seconds default
	let cycleDuration = $state(30000); // 30 seconds default
	let colorSpeed = $state(2000); // 2 seconds default
	let colorInterval = $state(30000); // 30 seconds default

	// Initialize from preset manager
	$effect(() => {
		transitionDuration = presetManager.transitions?.duration || 3000;
		cycleDuration = presetManager.state.cycleInterval;
		colorSpeed = presetManager.colorSpeed || 2000;
		colorInterval = presetManager.colorInterval || 30000;
	});

	// Check for unsaved changes when options change
	$effect(() => {
		if (presetManager.state.currentPresetId) {
			presetManager.checkForUnsavedChanges?.(currentMotionOptions);
		}
	});
	function handleCreatePreset() {
		if (!newPresetName.trim()) return;

		onCreatePreset(newPresetName.trim());
		newPresetName = '';
		newPresetDescription = '';
		showCreateDialog = false;
	}

	function toggleCycling() {
		if (presetManager.state.isPlaying) {
			presetManager.stopCycling();
		} else {
			presetManager.startCycling();
		}
	}
	function applySettings() {
		// Update transition duration
		presetManager.transitions.setDuration(transitionDuration);

		// Update cycle interval
		presetManager.setCycleInterval(cycleDuration);

		// Update color interval duration
		presetManager.setColorIntervalDuration(colorInterval);

		showSettingsDialog = false;
	}

	function handleSaveAsExisting() {
		presetManager.updateCurrentPreset?.(currentMotionOptions);
	}

	function handleSaveAsNew() {
		// Generate a name based on current preset + timestamp
		const baseName = presetManager.currentPreset?.name || 'Preset';
		const newName = `new ${baseName}`;

		presetManager.createPresetFromCurrent?.(newName, currentMotionOptions);
	}

	function handleDiscardChanges() {
		presetManager.discardChanges?.();
	}

	function formatTimeRemaining(ms: number): string {
		const seconds = Math.ceil(ms / 1000);
		return `${seconds}s`;
	}

	// Inline editing functions
	function startEditingPresetName(presetId: string, currentName: string) {
		editingPresetId = presetId;
		editingPresetName = currentName;
	}

	function savePresetName() {
		if (editingPresetId && editingPresetName.trim()) {
			presetManager.updatePresetName(editingPresetId, editingPresetName.trim());
		}
		cancelEditingPresetName();
	}

	function cancelEditingPresetName() {
		editingPresetId = null;
		editingPresetName = '';
	}

	function handlePresetNameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			savePresetName();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditingPresetName();
		}
	}

	let timeRemaining = $state(0);

	// Update time remaining every second when cycling
	$effect(() => {
		if (presetManager.state.isPlaying) {
			const interval = setInterval(() => {
				timeRemaining = presetManager.getTimeUntilNextCycle();
			}, 100);

			return () => clearInterval(interval);
		}
	});
</script>

<div class="preset-controls">
	<div class="preset-header">
		<h3>Motion Presets</h3>
		<div class="header-actions">
			<button
				class="create-btn"
				onclick={() => (showCreateDialog = true)}
				disabled={presetManager.state.isEditingPreset}
			>
				+ New
			</button>

			<button
				class="settings-btn"
				onclick={() => (showSettingsDialog = true)}
				disabled={presetManager.state.isEditingPreset}
			>
				⚙️ Settings
			</button>

			<button
				class="cycle-btn"
				class:active={presetManager.state.isPlaying}
				onclick={toggleCycling}
				disabled={presetManager.presets.length === 0}
			>
				{presetManager.state.isPlaying ? 'Stop' : 'Play'} Cycle
			</button>
		</div>
	</div>

	{#if presetManager.state.isPlaying}
		<div class="cycle-status">
			Next preset in: {formatTimeRemaining(timeRemaining)}
		</div>
	{/if}

	{#if presetManager.state.hasUnsavedChanges && presetManager.currentPreset}
		<div class="unsaved-changes-banner">
			<div class="unsaved-info">
				<strong>Save Changes</strong>
			</div>
			<div class="save-actions">
				<button class="reset-btn" onclick={handleDiscardChanges}> Reset </button>
				<button class="save-new-btn" onclick={handleSaveAsNew}> Save New </button>
				<button class="save-btn" onclick={handleSaveAsExisting}> Save </button>
			</div>
		</div>
	{/if}

	<div class="preset-list">
		{#each presetManager.presets as preset (preset.id)}
			<div
				class="preset-item"
				class:active={presetManager.state.currentPresetId === preset.id}
				class:editing={presetManager.state.isEditingPreset &&
					presetManager.state.currentPresetId === preset.id}
				onclick={() => presetManager.applyPreset(preset.id)}
			>
				<div class="preset-info">
					{#if editingPresetId === preset.id}
						<input
							type="text"
							bind:value={editingPresetName}
							onkeydown={handlePresetNameKeydown}
							onblur={savePresetName}
							class="preset-name-input"
							onclick={(e) => e.stopPropagation()}
							autofocus
						/>
					{:else}
						<h4 ondblclick={() => startEditingPresetName(preset.id, preset.name)}>
							{preset.name}
						</h4>
					{/if}
					<span class="move-type">Type: {preset.options.moveType}</span>
				</div>

				<div class="preset-actions" onclick={(e) => e.stopPropagation()}>
					<button
						class="delete-btn"
						onclick={() => presetManager.deletePreset(preset.id)}
						disabled={presetManager.state.isPlaying}
					>
						×
					</button>
				</div>
			</div>
		{/each}

		{#if presetManager.presets.length === 0}
			<div class="empty-state">
				<p>No presets created yet</p>
				<p class="hint">Create a preset to save your current motion settings</p>
			</div>
		{/if}
	</div>

	{#if presetManager.state.isEditingPreset}
		<div class="editing-controls">
			<div class="editing-status">
				<span>Editing: {presetManager.currentPreset?.name}</span>
			</div>
			<div class="editing-actions">
				<button
					class="save-btn"
					onclick={() => presetManager.saveEditingPreset(currentMotionOptions)}
				>
					Save Changes
				</button>
				<button class="cancel-btn" onclick={() => presetManager.cancelEditingPreset()}>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>

{#if showCreateDialog}
	<div class="dialog-overlay" onclick={() => (showCreateDialog = false)}>
		<div class="dialog" onclick={(e) => e.stopPropagation()}>
			<h3>Create New Preset</h3>
			<div class="form-group">
				<label for="preset-name">Name:</label>
				<input
					id="preset-name"
					type="text"
					bind:value={newPresetName}
					placeholder="Enter preset name"
					maxlength="50"
				/>
			</div>
			<div class="form-group">
				<label for="preset-description">Description (optional):</label>
				<textarea
					id="preset-description"
					bind:value={newPresetDescription}
					placeholder="Describe this preset..."
					maxlength="200"
				></textarea>
			</div>
			<div class="dialog-actions">
				<button onclick={() => (showCreateDialog = false)}>Cancel</button>
				<button class="primary" onclick={handleCreatePreset} disabled={!newPresetName.trim()}>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showSettingsDialog}
	<div class="dialog-overlay" role="presentation" onclick={() => (showSettingsDialog = false)}>
		<div
			class="dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="preset-settings-title"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 id="preset-settings-title">Preset Settings</h3>
			<div class="form-group">
				<label for="transition-duration">Transition Duration:</label>
				<div class="slider-group">
					<input
						id="transition-duration"
						type="range"
						min="500"
						max="10000"
						step="100"
						bind:value={transitionDuration}
					/>
					<span class="slider-value">{(transitionDuration / 1000).toFixed(1)}s</span>
				</div>
				<small>How long it takes to smoothly change between presets</small>
			</div>
			<div class="form-group">
				<label>Cycle Duration:</label>
				<div class="slider-group">
					<input
						id="cycle-duration"
						type="range"
						min="3000"
						max="300000"
						step="1000"
						bind:value={cycleDuration}
					/>
					<span class="slider-value">{(cycleDuration / 1000).toFixed(0)}s</span>
				</div>
				<small>How often to switch to a new preset during cycling</small>
			</div>
			<div class="form-group">
				<label for="color-interval">Color Change Interval:</label>
				<div class="slider-group">
					<input
						id="color-interval"
						type="range"
						min="1000"
						max="120000"
						step="1000"
						bind:value={colorInterval}
					/>
					<span class="slider-value">{(colorInterval / 1000).toFixed(0)}s</span>
				</div>
				<small>How often colors change to new random values</small>
			</div>
			<div class="dialog-actions">
				<button onclick={() => (showSettingsDialog = false)}>Cancel</button>
				<button class="primary" onclick={applySettings}>Apply Settings</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.preset-controls {
		background: rgba(0, 0, 0, 0.8);
		z-index: 20;
		position: absolute;
		border-radius: 8px;
		padding: 16px;
		margin: 16px;
		color: white;
		min-width: 300px;
	}

	.preset-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.preset-header h3 {
		margin: 0;
		font-size: 18px;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.create-btn,
	.cycle-btn,
	.settings-btn {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
	}

	.create-btn {
		background: #10b981;
		color: white;
	}

	.settings-btn {
		background: #6b7280;
		color: white;
	}

	.cycle-btn {
		background: #3b82f6;
		color: white;
	}

	.cycle-btn.active {
		background: #ef4444;
	}

	.cycle-status {
		background: rgba(59, 130, 246, 0.2);
		padding: 8px;
		border-radius: 4px;
		text-align: center;
		font-size: 12px;
		margin-bottom: 16px;
	}

	.unsaved-changes-banner {
		background: rgba(245, 158, 11, 0.2);
		border: 1px solid rgba(245, 158, 11, 0.4);
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.unsaved-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.unsaved-info strong {
		color: #f59e0b;
		font-size: 12px;
	}

	.save-actions {
		display: flex;
		gap: 6px;
	}

	.save-actions button {
		border: none;
		border-radius: 4px;
		padding: 6px 10px;
		font-size: 11px;
		cursor: pointer;
		font-weight: 500;
		transition: opacity 0.2s;
	}

	.save-actions button:hover {
		opacity: 0.8;
	}

	.reset-btn {
		background: #6b7280;
		color: white;
	}

	.save-new-btn {
		background: #10b981;
		color: white;
	}

	.save-btn {
		background: #f59e0b;
		color: white;
	}

	.preset-list {
		max-height: 300px;
		overflow-y: auto;
	}

	.preset-item {
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 8px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.preset-item:hover {
		border-color: rgba(255, 255, 255, 0.4);
		background: rgba(255, 255, 255, 0.05);
	}

	.preset-item.active {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.1);
	}

	.preset-item.editing {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.1);
	}

	.preset-info h4 {
		margin: 0 0 4px 0;
		font-size: 14px;
		cursor: pointer;
		user-select: none;
		padding: 2px 4px;
		border-radius: 3px;
		transition: background-color 0.2s;
	}

	.preset-info h4:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.preset-name-input {
		width: 100%;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid #3b82f6;
		border-radius: 3px;
		padding: 2px 4px;
		font-size: 14px;
		font-weight: bold;
		color: white;
		margin: 0 0 4px 0;
	}

	.preset-name-input:focus {
		outline: none;
		border-color: #60a5fa;
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
	}

	.preset-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.preset-actions button {
		padding: 4px 8px;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		font-size: 11px;
	}

	.delete-btn {
		background: #ef4444;
		color: white;
		width: 20px;
		padding: 4px;
	}

	.empty-state {
		text-align: center;
		padding: 32px;
		opacity: 0.7;
	}

	.empty-state .hint {
		font-size: 12px;
		margin-top: 8px;
	}

	.editing-controls {
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: 16px;
		margin-top: 16px;
	}

	.editing-status {
		background: rgba(245, 158, 11, 0.2);
		padding: 8px;
		border-radius: 4px;
		text-align: center;
		font-size: 12px;
		margin-bottom: 12px;
	}

	.editing-actions {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.save-btn,
	.cancel-btn {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.save-btn {
		background: #10b981;
		color: white;
	}

	.cancel-btn {
		background: #6b7280;
		color: white;
	}

	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.dialog {
		background: #1f2937;
		border-radius: 8px;
		padding: 24px;
		width: 90%;
		max-width: 400px;
		color: white;
	}

	.dialog h3 {
		margin: 0 0 16px 0;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 8px;
		border: 1px solid #374151;
		border-radius: 4px;
		background: #111827;
		color: white;
		font-size: 14px;
	}

	.form-group textarea {
		resize: vertical;
		min-height: 60px;
	}

	.dialog-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 24px;
	}

	.dialog-actions button {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.dialog-actions button:not(.primary) {
		background: #6b7280;
		color: white;
	}

	.dialog-actions button.primary {
		background: #3b82f6;
		color: white;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.slider-group {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 4px;
	}

	.slider-group input[type='range'] {
		flex: 1;
		height: 4px;
		background: #374151;
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.slider-group input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		background: #3b82f6;
		border-radius: 50%;
		cursor: pointer;
	}

	.slider-group input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #3b82f6;
		border-radius: 50%;
		border: none;
		cursor: pointer;
	}

	.slider-value {
		min-width: 40px;
		text-align: right;
		font-size: 12px;
		font-weight: 500;
		color: #3b82f6;
	}

	.form-group small {
		display: block;
		font-size: 11px;
		opacity: 0.7;
		margin-top: 4px;
	}
</style>
