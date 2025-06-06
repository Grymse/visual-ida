<script lang="ts">
	import { PresetManager } from './presets/PresetManager.svelte';
	import type { MotionDetectionOptions } from './MotionDetection.svelte';

	interface Props {
		presetManager: PresetManager;
		onCreatePreset: () => void;
		currentMotionOptions: MotionDetectionOptions;
	}

	let { presetManager, onCreatePreset, currentMotionOptions }: Props = $props();

	let newPresetName = $state('');
	let newPresetDescription = $state('');
	let showCreateDialog = $state(false);

	function handleCreatePreset() {
		if (!newPresetName.trim()) return;

		onCreatePreset();
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

	function formatTimeRemaining(ms: number): string {
		const seconds = Math.ceil(ms / 1000);
		return `${seconds}s`;
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

	<div class="preset-list">
		{#each presetManager.presets as preset (preset.id)}
			<div
				class="preset-item"
				class:active={presetManager.state.currentPresetId === preset.id}
				class:editing={presetManager.state.isEditingPreset &&
					presetManager.state.currentPresetId === preset.id}
			>
				<div class="preset-info">
					<h4>{preset.name}</h4>
					{#if preset.description}
						<p class="description">{preset.description}</p>
					{/if}
					<span class="move-type">Type: {preset.options.moveType}</span>
				</div>

				<div class="preset-actions">
					<button
						class="edit-btn"
						onclick={() => presetManager.startEditingPreset(preset.id)}
						disabled={presetManager.state.isPlaying}
					>
						Edit
					</button>

					<button
						class="apply-btn"
						onclick={() => presetManager.applyPreset(preset.id)}
						disabled={presetManager.state.isEditingPreset}
					>
						Apply
					</button>

					<button
						class="delete-btn"
						onclick={() => presetManager.deletePreset(preset.id)}
						disabled={presetManager.state.isEditingPreset || presetManager.state.isPlaying}
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
	.cycle-btn {
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
	}

	.preset-info .description {
		margin: 0 0 4px 0;
		font-size: 12px;
		opacity: 0.8;
	}

	.preset-info .move-type {
		font-size: 11px;
		opacity: 0.7;
		text-transform: capitalize;
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

	.edit-btn {
		background: #f59e0b;
		color: white;
	}

	.apply-btn {
		background: #10b981;
		color: white;
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
</style>
