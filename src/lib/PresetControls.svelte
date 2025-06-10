<script lang="ts">
	import type { MotionDetectionOptions } from './MotionDetection.svelte';
	import { PresetManager } from './presets/PresetManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import PresetList from '$lib/components/PresetList.svelte';
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
	let colorInterval = $state(30000);

	// Initialize from preset manager
	$effect(() => {
		transitionDuration = presetManager.transitions?.duration || 3000;
		cycleDuration = presetManager.state.cycleInterval;
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

	function handleToggleControls() {
		showControls = !showControls;
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
</script>

<!-- Preset Controls Sidebar -->
<div class="fixed top-0 left-0 z-50 h-full">
	<!-- Toggle Button -->
	{#if !showControls}
		<Button
			variant="secondary"
			size="sm"
			class={cn(
				'absolute top-4 left-4 shadow-lg backdrop-blur-sm transition-all duration-300',
				'bg-background/80 hover:bg-background/90 border-border/50 border'
			)}
			onclick={handleToggleControls}
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
	{/if}

	<!-- Sidebar Panel -->
	<div
		class={cn(
			'bg-background/95 border-border/50 h-full w-80 border-r shadow-2xl backdrop-blur-lg transition-transform duration-300 ease-in-out',
			showControls ? 'translate-x-0' : '-translate-x-full'
		)}
	>
		<div class="flex h-full flex-col p-4">
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
			<div class="mb-6 flex flex-shrink-0 gap-2">
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
						Stop cycle
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
							/>
						</svg>
						Start cycle
					{/if}
				</Button>
			</div>

			<!-- Unsaved Changes Banner -->
			{#if presetManager.state.hasUnsavedChanges && presetManager.currentPreset && !presetManager.state.isPlaying}
				<div class="mb-6 flex-shrink-0 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
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
			<PresetList
				{presetManager}
				bind:editingPresetId
				bind:editingPresetName
				onStartEditing={startEditingPresetName}
				onSaveEdit={savePresetName}
				onCancelEdit={cancelEditingPresetName}
				onKeydown={handlePresetNameKeydown}
			/>
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
				<Input id="preset-name" bind:value={newPresetName} placeholder="Enter preset name" />
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
				<Slider
					type="single"
					bind:value={transitionDuration}
					min={500}
					max={10000}
					step={100}
					class="w-full"
				/>
				<p class="text-muted-foreground text-xs">
					How long it takes to smoothly change between presets
				</p>
			</div>

			<div class="space-y-3">
				<div class="text-foreground text-sm font-medium">
					Cycle Duration:
					<span class="text-primary ml-1 font-medium">{(cycleDuration / 1000).toFixed(0)}s</span>
				</div>
				<Slider
					type="single"
					bind:value={cycleDuration}
					min={3000}
					max={300000}
					step={1000}
					class="w-full"
				/>
				<p class="text-muted-foreground text-xs">
					How often to switch to a new preset during cycling
				</p>
			</div>

			<div class="space-y-3">
				<div class="text-foreground text-sm font-medium">
					Color Change Interval:
					<span class="text-primary ml-1 font-medium">{(colorInterval / 1000).toFixed(0)}s</span>
				</div>
				<Slider
					type="single"
					bind:value={colorInterval}
					min={1000}
					max={120000}
					step={1000}
					class="w-full"
				/>
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
