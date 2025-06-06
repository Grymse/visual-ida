import type { MotionDetectionOptions } from '../MotionDetection.svelte';
import type { MotionDetectionPreset, PresetManagerState } from './types';
import { PresetStorage } from './storage';

export class PresetManager {
	private _presets = $state<MotionDetectionPreset[]>([]);
	private _state = $state<PresetManagerState>({
		currentPresetId: null,
		isPlaying: false,
		isEditingPreset: false,
		lastCycleTime: 0,
		cycleInterval: 3000 // 30 seconds
	});
	
	private cycleTimeout: ReturnType<typeof setTimeout> | null = null;
	private onPresetChangeCallback?: (options: MotionDetectionOptions) => void;

	constructor(onPresetChange?: (options: MotionDetectionOptions) => void) {
		this.onPresetChangeCallback = onPresetChange;
		this.loadPresets();
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

	// Load presets from localStorage
	private loadPresets(): void {
		this._presets = PresetStorage.load();
	}

	// Save presets to localStorage
	private savePresets(): void {
		PresetStorage.save(this._presets);
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

		this._presets[presetIndex] = {
			...this._presets[presetIndex],
			...updates,
			updatedAt: new Date()
		};

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
		if (!preset) return false;

		this._state.currentPresetId = id;
		if (this.onPresetChangeCallback) {
			this.onPresetChangeCallback(preset.options);
		}
		return true;
	}

	// Start automatic cycling through presets
	startCycling(): void {
		if (this._presets.length === 0) {
			console.warn('No presets available for cycling');
			return;
		}

		this._state.isPlaying = true;
		this._state.lastCycleTime = Date.now();
		this.scheduleNextCycle();
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

		// Get current index
		const currentIndex = this._state.currentPresetId 
			? this._presets.findIndex(p => p.id === this._state.currentPresetId)
			: -1;

		// Move to next preset (or first if none selected)
		const nextIndex = (currentIndex + 1) % this._presets.length;
		const nextPreset = this._presets[nextIndex];

		if (nextPreset) {
			this.applyPreset(nextPreset.id);
			this._state.lastCycleTime = Date.now();
		}

		// Schedule next cycle
		this.scheduleNextCycle();
	}

	// Start editing mode for a preset
	startEditingPreset(id: string): boolean {
		const preset = this._presets.find(p => p.id === id);
		if (!preset) return false;

		this._state.isEditingPreset = true;
		this._state.currentPresetId = id;
		
		// Stop cycling while editing
		if (this._state.isPlaying) {
			this.stopCycling();
		}

		return true;
	}

	// Save changes to the currently editing preset
	saveEditingPreset(options: MotionDetectionOptions): boolean {
		if (!this._state.isEditingPreset || !this._state.currentPresetId) {
			return false;
		}

		const success = this.updatePreset(this._state.currentPresetId, { options });
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

	// Set cycle interval
	setCycleInterval(intervalMs: number): void {
		this._state.cycleInterval = Math.max(1000, intervalMs); // Minimum 1 second
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
	}
}