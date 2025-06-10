<script lang="ts">
	import type { MotionDetectionOptions } from './MotionDetection.svelte';
	import type { PresetManager } from './presets/PresetManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Select from '$lib/components/ui/select/index.js';
	import { cn } from '$lib/utils';

	interface Props {
		isMotionDetectionActive?: boolean;
		toggleMotionDetection?: () => void;
		motionDetectionOptions: MotionDetectionOptions;
		presetManager: PresetManager;
	}

	let {
		isMotionDetectionActive = false,
		toggleMotionDetection = () => {},
		motionDetectionOptions = $bindable<MotionDetectionOptions>(),
		presetManager
	}: Props = $props();

	let showFilters = $state(false);
	let showCyclingMessage = $state(false);

	function handleToggleFilters() {
		// If cycling is active, don't allow opening controls
		if (presetManager.state.isPlaying && !showFilters) {
			// Show a brief message instead
			showCyclingMessage = true;
			setTimeout(() => {
				showCyclingMessage = false;
			}, 3000); // Hide message after 3 seconds
			return;
		}
		showFilters = !showFilters;
	}

	// Automatically close controls when cycling starts
	$effect(() => {
		if (presetManager.state.isPlaying && showFilters) {
			showFilters = false;
		}
	});

	function toggleFiltersPanel() {
		showFilters = !showFilters;
	}
</script>

<!-- Motion Detection Controls Sidebar -->
<div class="fixed top-0 right-0 z-50 h-full">
	<!-- Toggle Button -->
	{#if !showFilters}
		<Button
			variant="secondary"
			size="sm"
			class={cn(
				'absolute top-4 right-4 shadow-lg backdrop-blur-sm transition-all duration-300',
				'bg-background/80 hover:bg-background/90 border-border/50 border'
			)}
			onclick={handleToggleFilters}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
				/>
			</svg>
			Controls
		</Button>
	{/if}

	<!-- Cycling Message -->
	{#if showCyclingMessage}
		<div
			class={cn(
				'absolute top-16 right-4 shadow-lg backdrop-blur-sm transition-all duration-300',
				'bg-primary/90 text-primary-foreground border-primary/50 rounded-md border px-3 py-2 text-sm'
			)}
		>
			Stop cycling to access controls
		</div>
	{/if}

	<!-- Sidebar Panel -->
	<div
		class={cn(
			'bg-background/95 border-border/50 h-full w-72 border-l shadow-2xl backdrop-blur-lg transition-transform duration-300 ease-in-out',
			showFilters ? 'translate-x-0' : 'translate-x-full'
		)}
	>
		<div class="h-full overflow-y-auto p-4">
			<!-- Header -->
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-foreground text-lg font-semibold">Motion Controls</h2>
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => (showFilters = false)}>
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

			<!-- Motion Detection Toggle -->
			<div class="mb-6">
				<Button
					variant={isMotionDetectionActive ? 'default' : 'outline'}
					class="h-12 w-full text-sm font-medium"
					onclick={() => toggleMotionDetection()}
				>
					<div class="flex items-center gap-2">
						<div
							class={cn(
								'h-2 w-2 rounded-full transition-colors',
								isMotionDetectionActive ? 'bg-primary-foreground' : 'bg-muted-foreground'
							)}
						></div>
						Motion Detection
					</div>
				</Button>
			</div>

			{#if isMotionDetectionActive}
				<!-- Motion Movement Section -->
				<div class="space-y-6">
					<div class="space-y-4">
						<h3 class="text-foreground/90 text-sm font-semibold tracking-wide uppercase">
							Movement
						</h3>

						<!-- Move Type Selector -->
						<div class="space-y-2">
							<label class="text-muted-foreground text-xs font-medium">Effect Type</label>
							<Select.Root type="single" bind:value={motionDetectionOptions.moveType}>
								<Select.Trigger class="w-full">
									{motionDetectionOptions.moveType.charAt(0).toUpperCase() +
										motionDetectionOptions.moveType.slice(1)}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="direction">Directional</Select.Item>
									<Select.Item value="radial">Radial</Select.Item>
									<Select.Item value="spiral">Spiral</Select.Item>
									<Select.Item value="wave">Wave</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Direction-specific controls -->
						{#if motionDetectionOptions.moveType === 'direction'}
							<div class="space-y-2">
								<label class="text-muted-foreground text-xs font-medium">
									Angle: <span class="text-foreground font-semibold"
										>{motionDetectionOptions.movementAngle}°</span
									>
								</label>
								<Slider
									type="single"
									bind:value={motionDetectionOptions.movementAngle}
									min={0}
									max={360}
									step={1}
									class="w-full"
								/>
							</div>
						{/if}

						<!-- Speed control (common for direction, radial, spiral) -->
						{#if motionDetectionOptions.moveType !== 'wave'}
							<div class="space-y-2">
								<label class="text-muted-foreground text-xs font-medium">
									Speed: <span class="text-foreground font-semibold"
										>{motionDetectionOptions.movementSpeed.toFixed(1)}</span
									>
								</label>
								<Slider
									type="single"
									bind:value={motionDetectionOptions.movementSpeed}
									min={-30}
									max={100}
									step={1}
									class="w-full"
								/>
							</div>
						{/if}

						<!-- Spiral-specific controls -->
						{#if motionDetectionOptions.moveType === 'spiral'}
							<div class="space-y-2">
								<label class="text-muted-foreground text-xs font-medium">
									Rotation Speed: <span class="text-foreground font-semibold"
										>{motionDetectionOptions.rotationSpeed.toFixed(3)}</span
									>
								</label>
								<Slider
									type="single"
									bind:value={motionDetectionOptions.rotationSpeed}
									min={-3.14}
									max={3.14}
									step={0.001}
									class="w-full"
								/>
							</div>
						{/if}

						<!-- Wave-specific controls -->
						{#if motionDetectionOptions.moveType === 'wave'}
							<div class="space-y-4">
								<div class="space-y-2">
									<label class="text-muted-foreground text-xs font-medium">
										Amplitude: <span class="text-foreground font-semibold"
											>{motionDetectionOptions.waveAmplitude.toFixed(1)}</span
										>
									</label>
									<Slider
										type="single"
										bind:value={motionDetectionOptions.waveAmplitude}
										min={0}
										max={500}
										step={0.1}
										class="w-full"
									/>
								</div>
								<div class="space-y-2">
									<label class="text-muted-foreground text-xs font-medium">
										Frequency: <span class="text-foreground font-semibold"
											>{motionDetectionOptions.waveFrequency.toFixed(3)}</span
										>
									</label>
									<Slider
										type="single"
										bind:value={motionDetectionOptions.waveFrequency}
										min={0.001}
										max={2}
										step={0.001}
										class="w-full"
									/>
								</div>
								<div class="space-y-2">
									<label class="text-muted-foreground text-xs font-medium">
										Phase: <span class="text-foreground font-semibold"
											>{motionDetectionOptions.wavePhase.toFixed(2)}</span
										>
									</label>
									<Slider
										type="single"
										bind:value={motionDetectionOptions.wavePhase}
										min={0}
										max={6.28}
										step={0.01}
										class="w-full"
									/>
								</div>
								<div class="space-y-2">
									<label class="text-muted-foreground text-xs font-medium">Direction</label>
									<Select.Root type="single" bind:value={motionDetectionOptions.waveDirection}>
										<Select.Trigger class="w-full"
											>{motionDetectionOptions.waveDirection === 0
												? 'Horizontal'
												: 'Vertical'}</Select.Trigger
										>
										<Select.Content>
											<Select.Item value={0}>Horizontal</Select.Item>
											<Select.Item value={1}>Vertical</Select.Item>
										</Select.Content>
									</Select.Root>
								</div>
							</div>
						{/if}
					</div>

					<!-- Motion Detection Section -->
					<div class="border-border/50 space-y-4 border-t pt-6">
						<h3 class="text-foreground/90 text-sm font-semibold tracking-wide uppercase">
							Detection
						</h3>

						<div class="space-y-2">
							<label class="text-muted-foreground text-xs font-medium">
								Decay Rate: <span class="text-foreground font-semibold"
									>{motionDetectionOptions.motionDecayRate.toFixed(2)}</span
								>
							</label>
							<Slider
								type="single"
								bind:value={motionDetectionOptions.motionDecayRate}
								min={0.1}
								max={0.99}
								step={0.01}
								class="w-full"
							/>
						</div>

						<div class="space-y-2">
							<label class="text-muted-foreground text-xs font-medium">
								Threshold: <span class="text-foreground font-semibold"
									>{motionDetectionOptions.motionThreshold.toFixed(0)}</span
								>
							</label>
							<Slider
								type="single"
								bind:value={motionDetectionOptions.motionThreshold}
								min={1}
								max={100}
								step={1}
								class="w-full"
							/>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Mobile responsive styles */
	@media (max-width: 768px) {
		.fixed.top-0.right-0 .w-72 {
			width: 320px;
		}

		.absolute.top-4 {
			top: 8px;
		}
	}

	@media (max-width: 640px) {
		.fixed.top-0.right-0 .w-72 {
			width: 100%;
		}
	}
</style>
