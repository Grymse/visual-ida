<script lang="ts">
	import type { MotionDetectionOptions } from './MotionDetection.svelte';
	import { PresetManager } from './presets/PresetManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils';

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
	let showControls = $state(false);

	// Inline editing state
	let editingPresetId = $state<string | null>(null);
	let editingPresetName = $state('');

	// Local state for settings
	let transitionDuration = $state(3000);
	let cycleDuration = $state(30000);
	let colorSpeed = $state(2000);
	let colorInterval = $state(30000);

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
		presetManager.transitions.setDuration(transitionDuration);
		presetManager.setCycleInterval(cycleDuration);
		presetManager.setColorIntervalDuration(colorInterval);
		showSettingsDialog = false;
	}

	function handleSaveAsExisting() {
		presetManager.updateCurrentPreset?.(currentMotionOptions);
	}

	function handleSaveAsNew() {
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

<!-- Preset Controls Sidebar -->
<div class="fixed top-0 left-0 z-50 h-full">
	<!-- Toggle Button -->
	<Button
		variant="secondary"
		size="sm"
		class={cn(
			'absolute top-4 shadow-lg backdrop-blur-sm transition-all duration-300',
			showControls ? 'left-[320px]' : 'left-4',
			'bg-background/80 hover:bg-background/90 border-border/50 border'
		)}
		onclick={() => (showControls = !showControls)}
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
			/>
		</svg>
		Presets
	</Button>

	<!-- Sidebar Panel -->
	<div
		class={cn(
			'bg-background/95 border-border/50 h-full w-80 border-r shadow-2xl backdrop-blur-lg transition-transform duration-300 ease-in-out',
			showControls ? 'translate-x-0' : '-translate-x-full'
		)}
	>
		<div class="h-full overflow-y-auto p-4">
			<!-- Header -->
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-foreground text-lg font-semibold">Motion Presets</h2>
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => (showControls = false)}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</Button>
			</div>

			<!-- Action Buttons -->
			<div class="mb-6 flex gap-2">
				<Button
					variant="default"
					size="sm"
					class="flex-1"
					onclick={() => (showCreateDialog = true)}
					disabled={presetManager.state.isEditingPreset}
				>
					<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					New
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={() => (showSettingsDialog = true)}
					disabled={presetManager.state.isEditingPreset}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</Button>

				<Button
					variant={presetManager.state.isPlaying ? 'destructive' : 'secondary'}
					size="sm"
					onclick={toggleCycling}
					disabled={presetManager.presets.length === 0}
				>
					{#if presetManager.state.isPlaying}
						<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 4h4v16H6zM14 4h4v16h-4z"
							/>
						</svg>
						Stop
					{:else}
						<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8"
							/>
						</svg>
						Cycle
					{/if}
				</Button>
			</div>

			<!-- Cycling Status -->
			{#if presetManager.state.isPlaying}
				<div class="bg-primary/10 border-primary/20 mb-6 rounded-lg border p-3">
					<div class="text-primary text-sm font-medium">Cycling Active</div>
					<div class="text-muted-foreground text-xs">
						Next preset in: {formatTimeRemaining(timeRemaining)}
					</div>
				</div>
			{/if}

			<!-- Unsaved Changes Banner -->
			{#if presetManager.state.hasUnsavedChanges && presetManager.currentPreset}
				<div class="mb-6 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
					<div class="mb-3 flex items-center justify-between">
						<div class="text-sm font-medium text-yellow-600 dark:text-yellow-400">
							Unsaved Changes
						</div>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={handleDiscardChanges} class="flex-1">
							Reset
						</Button>
						<Button variant="secondary" size="sm" onclick={handleSaveAsNew} class="flex-1">
							Save New
						</Button>
						<Button variant="default" size="sm" onclick={handleSaveAsExisting} class="flex-1">
							Save
						</Button>
					</div>
				</div>
			{/if}

			<!-- Preset List -->
			<div class="space-y-2">
				<h3 class="text-foreground/90 text-sm font-semibold tracking-wide uppercase">Presets</h3>

				{#if presetManager.presets.length === 0}
					<div
						class="text-muted-foreground border-border rounded-lg border-2 border-dashed p-8 text-center"
					>
						<svg
							class="mx-auto mb-2 h-8 w-8 opacity-50"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
							/>
						</svg>
						<p class="text-sm">No presets created yet</p>
						<p class="text-xs opacity-70">Create a preset to save your motion settings</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each presetManager.presets as preset (preset.id)}
							<div
								class={cn(
									'group hover:bg-accent/50 relative cursor-pointer rounded-lg border p-3 transition-all',
									presetManager.state.currentPresetId === preset.id
										? 'border-primary bg-primary/5'
										: 'border-border hover:border-border/60',
									presetManager.state.isEditingPreset &&
										presetManager.state.currentPresetId === preset.id &&
										'border-yellow-500 bg-yellow-500/5'
								)}
								onclick={() => presetManager.applyPreset(preset.id)}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										{#if editingPresetId === preset.id}
											<Input
												bind:value={editingPresetName}
												onkeydown={handlePresetNameKeydown}
												onblur={savePresetName}
												onclick={(e) => e.stopPropagation()}
												class="mb-1 h-8 text-sm font-medium"
												autofocus
											/>
										{:else}
											<h4
												class="text-foreground mb-1 text-sm font-medium hover:underline"
												ondblclick={() => startEditingPresetName(preset.id, preset.name)}
											>
												{preset.name}
											</h4>
										{/if}
										<p class="text-muted-foreground text-xs">
											Type: {preset.options.moveType.charAt(0).toUpperCase() +
												preset.options.moveType.slice(1)}
										</p>
									</div>

									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 opacity-0 group-hover:opacity-100"
										onclick={(e) => {
											e.stopPropagation();
											presetManager.deletePreset(preset.id);
										}}
										disabled={presetManager.state.isPlaying}
									>
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Editing Controls -->
			{#if presetManager.state.isEditingPreset}
				<div class="border-border/50 mt-6 space-y-4 border-t pt-6">
					<div class="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
						<div class="mb-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
							Editing: {presetManager.currentPreset?.name}
						</div>
						<div class="flex gap-2">
							<Button
								variant="default"
								size="sm"
								onclick={() => presetManager.saveEditingPreset(currentMotionOptions)}
								class="flex-1"
							>
								Save Changes
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => presetManager.cancelEditingPreset()}
								class="flex-1"
							>
								Cancel
							</Button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Create Preset Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create New Preset</Dialog.Title>
			<Dialog.Description>
				Save your current motion settings as a new preset for quick access later.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<label for="preset-name" class="text-foreground text-sm font-medium">Name</label>
				<Input
					id="preset-name"
					bind:value={newPresetName}
					placeholder="Enter preset name"
					maxlength="50"
				/>
			</div>
			<div class="space-y-2">
				<label for="preset-description" class="text-foreground text-sm font-medium"
					>Description (optional)</label
				>
				<Input
					id="preset-description"
					bind:value={newPresetDescription}
					placeholder="Describe this preset..."
					maxlength="200"
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showCreateDialog = false)}>Cancel</Button>
			<Button onclick={handleCreatePreset} disabled={!newPresetName.trim()}>Create Preset</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Settings Dialog -->
<Dialog.Root bind:open={showSettingsDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Preset Settings</Dialog.Title>
			<Dialog.Description>
				Configure timing and behavior for preset cycling and transitions.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-6 py-4">
			<div class="space-y-3">
				<label class="text-foreground text-sm font-medium">
					Transition Duration:
					<span class="text-primary ml-1 font-medium"
						>{(transitionDuration / 1000).toFixed(1)}s</span
					>
				</label>
				<Slider bind:value={transitionDuration} min={500} max={10000} step={100} class="w-full" />
				<p class="text-muted-foreground text-xs">
					How long it takes to smoothly change between presets
				</p>
			</div>

			<div class="space-y-3">
				<label class="text-foreground text-sm font-medium">
					Cycle Duration:
					<span class="text-primary ml-1 font-medium">{(cycleDuration / 1000).toFixed(0)}s</span>
				</label>
				<Slider bind:value={cycleDuration} min={3000} max={300000} step={1000} class="w-full" />
				<p class="text-muted-foreground text-xs">
					How often to switch to a new preset during cycling
				</p>
			</div>

			<div class="space-y-3">
				<label class="text-foreground text-sm font-medium">
					Color Change Interval:
					<span class="text-primary ml-1 font-medium">{(colorInterval / 1000).toFixed(0)}s</span>
				</label>
				<Slider bind:value={colorInterval} min={1000} max={120000} step={1000} class="w-full" />
				<p class="text-muted-foreground text-xs">How often colors change to new random values</p>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showSettingsDialog = false)}>Cancel</Button>
			<Button onclick={applySettings}>Apply Settings</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	/* Mobile responsive styles */
	@media (max-width: 768px) {
		.fixed.top-0.left-0 .w-80 {
			width: 100%;
		}

		.absolute.top-4 {
			top: 8px;
		}
	}
</style>
