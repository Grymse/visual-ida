import type { MotionDetectionPreset, PresetManagerState } from './types';
import { PresetStorage } from './storage';
import { PresetTransitionManager } from './PresetTransitionManager.svelte';
import { SettingsStorage, type PresetSettings } from './settingsStorage';
import type { MotionDetectionOptions } from '$lib/MotionDetection.svelte';

export class PresetManager {
	private _presets = $state<MotionDetectionPreset[]>([]);
	private _state = $state<PresetManagerState>({
		currentPresetId: null,
		isPlaying: false,
		isEditingPreset: false,
		lastCycleTime: 0,
		cycleInterval: 30000, // Will be loaded from settings
		hasUnsavedChanges: false,
		lastAppliedOptions: null
	});
	
	private cycleTimeout: ReturnType<typeof setTimeout> | null = null;
	private transitionManager: PresetTransitionManager;
	private getCurrentOptionsCallback?: () => MotionDetectionOptions;
	private colorTransitionSpeed = 2000; // Default 2 seconds
	private onColorIntervalChangeCallback?: (interval: number) => void;
	private colorIntervalDuration = 30000; // Default 30 seconds

	constructor(
		onPresetChange?: (options: MotionDetectionOptions) => void,
		getCurrentOptions?: () => MotionDetectionOptions,
		onColorIntervalChange?: (interval: number) => void
	) {
		this.getCurrentOptionsCallback = getCurrentOptions;
		this.onColorIntervalChangeCallback = onColorIntervalChange;
		this.transitionManager = new PresetTransitionManager(
			onPresetChange,
			() => this.saveSettings() // Save settings when transition duration changes
		);
		this.loadPresets();
		this.loadSettings();
	}

	// Getters for reactive state
	get presets() {
		return this._presets;
	}

	set presets(value: MotionDetectionPreset[]) {
		// Create a new array to trigger reactivity
		this._presets = [...value];
		this.savePresets();
	}

	get state() {
		return this._state;
	}

	get currentPreset(): MotionDetectionPreset | null {
		return this._presets.find(p => p.id === this._state.currentPresetId) || null;
	}

	// Expose transition manager for settings
	get transitions(): PresetTransitionManager {
		return this.transitionManager;
	}

	// Load presets from localStorage
	private loadPresets(): void {
		this._presets = PresetStorage.load();
	}

	// Save presets to localStorage
	private savePresets(): void {
		PresetStorage.save(this._presets);
	}

	// Load settings from localStorage
	private loadSettings(): void {
		const settings = SettingsStorage.load();
		this._state.cycleInterval = settings.cycleDuration;
		this.transitionManager.setDuration(settings.transitionDuration);
		this.colorIntervalDuration = settings.colorIntervalDuration;
		if (this.onColorIntervalChangeCallback) {
			this.onColorIntervalChangeCallback(settings.colorIntervalDuration);
		}
	}

	// Save settings to localStorage
	private saveSettings(): void {
		const settings: PresetSettings = {
			transitionDuration: this.transitionManager.duration,
			cycleDuration: this._state.cycleInterval,
			colorIntervalDuration: this.colorIntervalDuration
		};
		SettingsStorage.save(settings);
	}

	// Set cycle interval and save to localStorage
	setCycleInterval(intervalMs: number): void {
		this._state.cycleInterval = Math.max(1000, intervalMs); // Minimum 1 second
		this.saveSettings();
	}

	// Get current color transition speed
	get colorSpeed(): number {
		return this.colorTransitionSpeed;
	}

	// Set color interval duration and save to localStorage
	setColorIntervalDuration(intervalMs: number): void {
		this.colorIntervalDuration = Math.max(1000, intervalMs); // Minimum 1 second
		if (this.onColorIntervalChangeCallback) {
			this.onColorIntervalChangeCallback(this.colorIntervalDuration);
		}
		this.saveSettings();
	}

	// Get current color interval duration
	get colorInterval(): number {
		return this.colorIntervalDuration;
	}

	// Create a new preset
	createPreset(name: string, options: MotionDetectionOptions, description?: string): string {
		const id = `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const now = new Date();
		
		const newPreset: MotionDetectionPreset = {
			id,
			name,
			description,
			options: { ...options }, // Deep copy
			createdAt: now,
			updatedAt: now
		};

		this._presets.push(newPreset);
		this.savePresets();
		return id;
	}

	// Update an existing preset
	updatePreset(id: string, updates: Partial<Omit<MotionDetectionPreset, 'id' | 'createdAt'>>): boolean {
		const presetIndex = this._presets.findIndex(p => p.id === id);
		if (presetIndex === -1) return false;

		// Create a new array to trigger reactivity
		const updatedPresets = [...this._presets];
		updatedPresets[presetIndex] = {
			...updatedPresets[presetIndex],
			...updates,
			updatedAt: new Date()
		};
		
		// Assign the new array to trigger Svelte reactivity
		this._presets = updatedPresets;
		this.savePresets();
		return true;
	}

	// Update just the name of a preset
	updatePresetName(id: string, name: string): boolean {
		return this.updatePreset(id, { name: name.trim() });
	}

	// Delete a preset
	deletePreset(id: string): boolean {
		const initialLength = this._presets.length;
		this._presets = this._presets.filter(p => p.id !== id);
		
		if (this._state.currentPresetId === id) {
			this._state.currentPresetId = null;
		}

		if (this._presets.length !== initialLength) {
			this.savePresets();
			return true;
		}
		return false;
	}

	// Select a preset (without applying it)
	selectPreset(id: string): boolean {
		const preset = this._presets.find(p => p.id === id);
		if (!preset) return false;

		this._state.currentPresetId = id;
		return true;
	}

	// Apply a preset's options
	applyPreset(id: string, useTransition: boolean = false): boolean {
		const preset = this._presets.find(p => p.id === id);
		if (!preset) {
			console.warn(`Preset with id ${id} not found`);
			return false;
		}

		this._state.currentPresetId = id;
		
		// Store the applied options for change detection
		this._state.lastAppliedOptions = { ...preset.options };
		this._state.hasUnsavedChanges = false;
		
		// Create a deep copy of target options
		const targetOptions: MotionDetectionOptions = { ...preset.options };

		if (useTransition) {
			// Get current options for smooth transition (only during cycling)
			let currentOptions: MotionDetectionOptions;
			if (this.getCurrentOptionsCallback) {
				currentOptions = this.getCurrentOptionsCallback();
			} else {
				// Fallback: use default values
				currentOptions = {
					motionDecayRate: 0.8,
					movementAngle: 280,
					movementSpeed: 40,
					motionThreshold: 30,
					motionSensitivity: 1.5,
					moveType: 'direction',
					rotationSpeed: 0.1,
					waveAmplitude: 5.0,
					waveFrequency: 0.02,
					wavePhase: 0.0,
					waveDirection: 0
				};
			}

			// Start smooth transition
			this.transitionManager.startTransition(currentOptions, targetOptions);
		} else {
			// Apply immediately without transition (for manual selection)
			this.transitionManager.applyImmediately(targetOptions);
		}
		
		return true;
	}

	// Check if current settings differ from the last applied preset
	checkForUnsavedChanges(currentOptions: MotionDetectionOptions): void {
		// Don't check for unsaved changes when cycling is active
		// as transitions between presets create false positives
		if (this._state.isPlaying) {
			this._state.hasUnsavedChanges = false;
			return;
		}

		if (!this._state.lastAppliedOptions || !this._state.currentPresetId) {
			this._state.hasUnsavedChanges = false;
			return;
		}

		// Helper function to compare values with tolerance for floating-point numbers
		const isSignificantlyDifferent = (current: any, saved: any, key: string): boolean => {
			// Skip movementAngle as it's animated and constantly changing
			if (key === 'movementAngle') return false;
			
			// For string values (like moveType), use exact comparison
			if (typeof current === 'string' || typeof saved === 'string') {
				return current !== saved;
			}
			
			// For numeric values, use tolerance-based comparison
			if (typeof current === 'number' && typeof saved === 'number') {
				// Define tolerance based on the typical precision of each property
				let tolerance = 0.05; // Default tolerance for most values
				
				// Adjust tolerance based on the property and its typical ranges
				switch (key) {
					case 'waveFrequency':
						tolerance = 0.01; // Frequency ranges 0.001-2, step 0.001
						break;
					case 'rotationSpeed':
						tolerance = 0.01; // Rotation ranges -3.14-3.14, step 0.001
						break;
					case 'movementSpeed':
						tolerance = 1; // Speed ranges -30-100, step 1 (integer)
						break;
					case 'waveAmplitude':
						tolerance = 1; // Amplitude ranges 0-500, step 0.1
						break;
					case 'motionDecayRate':
						tolerance = 0.01; // Decay ranges 0.1-0.99, step 0.01
						break;
					case 'wavePhase':
						tolerance = 0.05; // Phase ranges 0-6.28, step 0.01
						break;
					case 'motionThreshold':
						tolerance = 1; // Threshold ranges 1-100, step 1 (integer)
						break;
					case 'motionSensitivity':
						tolerance = 0.1; // Sensitivity typically decimal values
						break;
					case 'movementAngle':
						tolerance = 1; // Angle ranges 0-360, step 1 (integer)
						break;
					case 'waveDirection':
						tolerance = 0; // Integer values should be exact (0 or 1)
						break;
				}
				
				return Math.abs(current - saved) > tolerance;
			}
			
			// Fallback to exact comparison
			return current !== saved;
		};

		// Compare current options with last applied options
		const hasChanges = Object.keys(currentOptions).some(key => {
			const k = key as keyof MotionDetectionOptions;
			return isSignificantlyDifferent(currentOptions[k], this._state.lastAppliedOptions![k], k);
		});

		this._state.hasUnsavedChanges = hasChanges;
	}

	// Update current preset with new options
	updateCurrentPreset(options: MotionDetectionOptions): boolean {
		if (!this._state.currentPresetId) return false;
		
		const success = this.updatePreset(this._state.currentPresetId, { options: { ...options } });
		if (success) {
			this._state.lastAppliedOptions = { ...options };
			this._state.hasUnsavedChanges = false;
		}
		return success;
	}

	// Create new preset from current options
	createPresetFromCurrent(name: string, options: MotionDetectionOptions, description?: string): string {
		const id = this.createPreset(name, options, description);
		// Switch to the new preset
		this._state.currentPresetId = id;
		this._state.lastAppliedOptions = { ...options };
		this._state.hasUnsavedChanges = false;
		return id;
	}

	// Discard changes and revert to last applied preset
	discardChanges(): void {
		if (this._state.currentPresetId && this._state.lastAppliedOptions) {
			this.applyPreset(this._state.currentPresetId, false); // No transition for manual discard
		}
	}

	// Start automatic cycling through presets
	startCycling(): void {
		if (this._presets.length === 0) {
			console.warn('No presets available for cycling');
			return;
		}

		this._state.isPlaying = true;
		this._state.lastCycleTime = 0;
		
		// Clear unsaved changes flag when cycling starts
		this._state.hasUnsavedChanges = false;
		
		// Apply a random preset immediately instead of waiting
		this.cycleToNextPreset();
	}

	// Stop automatic cycling
	stopCycling(): void {
		this._state.isPlaying = false;
		if (this.cycleTimeout) {
			clearTimeout(this.cycleTimeout);
			this.cycleTimeout = null;
		}
		
		// Cancel any ongoing transition when stopping cycle
		this.transitionManager.cancelTransition();
		this._state.hasUnsavedChanges = false;
	}

	// Schedule the next preset cycle
	private scheduleNextCycle(): void {
		if (!this._state.isPlaying) return;

		this.cycleTimeout = setTimeout(() => {
			this.cycleToNextPreset();
		}, this._state.cycleInterval);
	}

	// Cycle to the next preset
	private cycleToNextPreset(): void {
		if (this._presets.length === 0) return;

		// For single preset, just apply it
		if (this._presets.length === 1) {
			const onlyPreset = this._presets[0];
			this.applyPreset(onlyPreset.id, true); // Use transition during cycling
			this._state.lastCycleTime = Date.now();
			this.scheduleNextCycle();
			return;
		}

		// Get available presets (excluding current one for variety)
		const availablePresets = this._state.currentPresetId 
			? this._presets.filter(p => p.id !== this._state.currentPresetId)
			: this._presets;

		// Select a random preset from available ones
		const randomIndex = Math.floor(Math.random() * availablePresets.length);
		const randomPreset = availablePresets[randomIndex];

		if (randomPreset) {
			this.applyPreset(randomPreset.id, true); // Use transition during cycling
			this._state.lastCycleTime = Date.now();
		}

		// Schedule next cycle
		this.scheduleNextCycle();
	}

	// Start editing mode for a preset
	startEditingPreset(id: string): boolean {
		const preset = this._presets.find(p => p.id === id);
		if (!preset) return false;

		// Stop cycling while editing
		if (this._state.isPlaying) {
			this.stopCycling();
		}

		// Apply the preset first so user can see its current effects
		this.applyPreset(id, false); // No transition for manual editing
		
		// Then enter edit mode
		this._state.isEditingPreset = true;
		this._state.currentPresetId = id;

		return true;
	}

	// Save changes to the currently editing preset
	saveEditingPreset(options: MotionDetectionOptions): boolean {
		if (!this._state.isEditingPreset || !this._state.currentPresetId) {
			return false;
		}

		// Create a deep copy of the options to avoid reference issues
		const optionsCopy: MotionDetectionOptions = {
			motionDecayRate: options.motionDecayRate,
			movementAngle: options.movementAngle,
			movementSpeed: options.movementSpeed,
			motionThreshold: options.motionThreshold,
			motionSensitivity: options.motionSensitivity,
			moveType: options.moveType,
			rotationSpeed: options.rotationSpeed,
			waveAmplitude: options.waveAmplitude,
			waveFrequency: options.waveFrequency,
			wavePhase: options.wavePhase,
			waveDirection: options.waveDirection
		};

		const success = this.updatePreset(this._state.currentPresetId, { options: optionsCopy });
		if (success) {
			this._state.isEditingPreset = false;
		}
		return success;
	}

	// Cancel editing mode
	cancelEditingPreset(): void {
		this._state.isEditingPreset = false;
		// Optionally revert to the saved preset
		if (this._state.currentPresetId) {
			this.applyPreset(this._state.currentPresetId, false); // No transition for manual cancel
		}
	}
	// Get time until next cycle
	getTimeUntilNextCycle(): number {
		if (!this._state.isPlaying) return 0;
		const elapsed = Date.now() - this._state.lastCycleTime;
		return Math.max(0, this._state.cycleInterval - elapsed);
	}

	// Reorder presets (for drag and drop functionality)
	reorderPresets(fromIndex: number, toIndex: number): void {
		if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
		if (fromIndex >= this._presets.length || toIndex >= this._presets.length) return;

		// Create a new array to ensure reactivity
		const newPresets = [...this._presets];
		
		// Remove the preset from the original position
		const [movedPreset] = newPresets.splice(fromIndex, 1);
		
		// Insert it at the new position
		newPresets.splice(toIndex, 0, movedPreset);
		
		// Update the presets array to trigger reactivity
		this._presets = newPresets;
		
		// Save to localStorage
		this.savePresets();
	}

	// Cleanup
	destroy(): void {
		this.stopCycling();
		this.transitionManager.destroy();
	}
}