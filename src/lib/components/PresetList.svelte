<script lang="ts">
	import type { MotionDetectionOptions } from '../MotionDetection.svelte';
	import type { PresetManager } from '../presets/PresetManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Progress } from '$lib/components/ui/progress';
	import { cn } from '$lib/utils';

	interface Props {
		presetManager: PresetManager;
		editingPresetId: string | null;
		editingPresetName: string;
		onStartEditing: (id: string, name: string) => void;
		onSaveEdit: () => void;
		onCancelEdit: () => void;
		onKeydown: (event: KeyboardEvent) => void;
	}

	let {
		presetManager,
		editingPresetId = $bindable(),
		editingPresetName = $bindable(),
		onStartEditing,
		onSaveEdit,
		onCancelEdit,
		onKeydown
	}: Props = $props();

	let draggedIndex: number | null = $state(null);
	let dragOverIndex: number | null = $state(null);
	let cycleProgress = $state(0);

	// Update cycling progress
	$effect(() => {
		if (presetManager.state.isPlaying) {
			const interval = setInterval(() => {
				const timeRemaining = presetManager.getTimeUntilNextCycle();
				const totalTime = presetManager.state.cycleInterval;
				const elapsed = totalTime - timeRemaining;
				cycleProgress = Math.min(100, (elapsed / totalTime) * 100);
			}, 100);
			return () => clearInterval(interval);
		} else {
			cycleProgress = 0;
		}
	});

	function handleDragStart(event: DragEvent, index: number) {
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		dragOverIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(event: DragEvent, dropIndex: number) {
		event.preventDefault();

		if (draggedIndex !== null && draggedIndex !== dropIndex) {
			presetManager.reorderPresets(draggedIndex, dropIndex);
		}

		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function getMotionIcon(moveType: string) {
		switch (moveType) {
			case 'direction':
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />`;
			case 'radial':
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /><circle cx="12" cy="12" r="3" />`;
			case 'spiral':
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />`;
			case 'wave':
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`;
			default:
				return '';
		}
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<h3 class="text-foreground/90 mb-3 text-sm font-semibold tracking-wide uppercase">Presets</h3>

	{#if presetManager.presets.length === 0}
		<div
			class="text-muted-foreground border-border rounded-lg border-2 border-dashed p-6 text-center"
		>
			<svg
				class="mx-auto mb-2 h-6 w-6 opacity-50"
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
		<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
			{#each presetManager.presets as preset, index (preset.id)}
				<div
					class={cn(
						'group relative cursor-pointer rounded-md border px-3 py-2 transition-all',
						presetManager.state.currentPresetId === preset.id
							? 'border-primary bg-primary/5'
							: 'border-border hover:border-border/60',
						presetManager.state.isEditingPreset &&
							presetManager.state.currentPresetId === preset.id &&
							'border-yellow-500 bg-yellow-500/5',
						dragOverIndex === index && 'border-primary/50 bg-primary/10',
						draggedIndex === index && 'opacity-50'
					)}
					draggable="true"
					ondragstart={(e) => handleDragStart(e, index)}
					ondragover={(e) => handleDragOver(e, index)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, index)}
					ondragend={handleDragEnd}
					onclick={() => presetManager.applyPreset(preset.id)}
				>
					<div class="flex items-center gap-3">
						<!-- Motion Type Icon -->
						<div class="text-muted-foreground flex-shrink-0">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{@html getMotionIcon(preset.options.moveType)}
							</svg>
						</div>

						<!-- Preset Name -->
						<div class="min-w-0 flex-1">
							{#if editingPresetId === preset.id}
								<Input
									bind:value={editingPresetName}
									onkeydown={onKeydown}
									onblur={onSaveEdit}
									onclick={(e) => e.stopPropagation()}
									class="h-6 text-sm font-medium"
									autofocus
								/>
							{:else}
								<h4
									class="text-foreground truncate text-sm font-medium hover:underline"
									ondblclick={() => onStartEditing(preset.id, preset.name)}
									title={preset.name}
								>
									{preset.name}
								</h4>
							{/if}
						</div>

						<!-- Control Buttons -->
						<div
							class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
						>
							<!-- Delete Button -->
							<Button
								variant="ghost"
								size="icon"
								class="h-6 w-6 flex-shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
								onclick={(e) => {
									e.stopPropagation();
									presetManager.deletePreset(preset.id);
								}}
								disabled={presetManager.state.isPlaying}
								title="Delete preset"
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

					<!-- Cycling Progress Bar (only shown for active preset during cycling) -->
					{#if presetManager.state.isPlaying && presetManager.state.currentPresetId === preset.id}
						<div class="mt-2 flex items-center gap-2">
							<div class="flex-1">
								<Progress value={cycleProgress} class="h-1.5" />
							</div>
							<div class="text-muted-foreground min-w-[3ch] font-mono text-xs">
								{Math.ceil(
									(presetManager.state.cycleInterval -
										(presetManager.state.cycleInterval * cycleProgress) / 100) /
										1000
								)}s
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
