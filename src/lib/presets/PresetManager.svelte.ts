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
	private onColorSpeedChangeCallback?: (speed: number) => void;
	private colorTransitionSpeed = 2000; // Default 2 seconds

	constructor(
		onPresetChange?: (options: MotionDetectionOptions) => void,
		getCurrentOptions?: () => MotionDetectionOptions,
		onColorSpeedChange?: (speed: number) => void
	) {
		this.getCurrentOptionsCallback = getCurrentOptions;
		this.onColorSpeedChangeCallback = onColorSpeedChange;
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
		this.colorTransitionSpeed = settings.colorTransitionSpeed;
		if (this.onColorSpeedChangeCallback) {
			this.onColorSpeedChangeCallback(settings.colorTransitionSpeed);
		}
	}

	// Save settings to localStorage
	private saveSettings(): void {
		const settings: PresetSettings = {
			transitionDuration: this.transitionManager.duration,
			cycleDuration: this._state.cycleInterval,
			colorTransitionSpeed: this.colorTransitionSpeed
		};
		SettingsStorage.save(settings);
	}

	// Set cycle interval and save to localStorage
	setCycleInterval(intervalMs: number): void {
		this._state.cycleInterval = Math.max(1000, intervalMs); // Minimum 1 second
		this.saveSettings();
	}

	// Set color transition speed and save to localStorage
	setColorTransitionSpeed(speedMs: number): void {
		this.colorTransitionSpeed = Math.max(100, speedMs); // Minimum 100ms
		if (this.onColorSpeedChangeCallback) {
			this.onColorSpeedChangeCallback(this.colorTransitionSpeed);
		}
		this.saveSettings();
	}

	// Get current color transition speed
	get colorSpeed(): number {
		return this.colorTransitionSpeed;
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
	applyPreset(id: string): boolean {
		const preset = this._presets.find(p => p.id === id);
		if (!preset) {
			console.warn(`Preset with id ${id} not found`);
			return false;
		}

		console.log('Applying preset:', preset.name, preset.options);
		this._state.currentPresetId = id;
		
		// Store the applied options for change detection
		this._state.lastAppliedOptions = { ...preset.options };
		this._state.hasUnsavedChanges = false;
		
		// Get current options for smooth transition
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

		// Create a deep copy of target options
		const targetOptions: MotionDetectionOptions = { ...preset.options };

		// Start smooth transition
		this.transitionManager.startTransition(currentOptions, targetOptions);
		
		return true;
	}

	// Check if current settings differ from the last applied preset
	checkForUnsavedChanges(currentOptions: MotionDetectionOptions): void {
		if (!this._state.lastAppliedOptions || !this._state.currentPresetId) {
			this._state.hasUnsavedChanges = false;
			return;
		}

		// Compare current options with last applied options
		const hasChanges = Object.keys(currentOptions).some(key => {
            if (key === 'movementAngle') return false;

			const k = key as keyof MotionDetectionOptions;
			return currentOptions[k] !== this._state.lastAppliedOptions![k];
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
			this.applyPreset(this._state.currentPresetId);
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
			this.applyPreset(onlyPreset.id);
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
			this.applyPreset(randomPreset.id);
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
		this.applyPreset(id);
		
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
			this.applyPreset(this._state.currentPresetId);
		}
	}
	// Get time until next cycle
	getTimeUntilNextCycle(): number {
		if (!this._state.isPlaying) return 0;
		const elapsed = Date.now() - this._state.lastCycleTime;
		return Math.max(0, this._state.cycleInterval - elapsed);
	}

	// Cleanup
	destroy(): void {
		this.stopCycling();
		this.transitionManager.destroy();
	}
}