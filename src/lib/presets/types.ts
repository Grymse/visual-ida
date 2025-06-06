import type { MotionDetectionOptions } from '../MotionDetection.svelte';

export interface MotionDetectionPreset {
	id: string;
	name: string;
	description?: string;
	options: MotionDetectionOptions;
	createdAt: Date;
	updatedAt: Date;
}

export interface PresetManagerState {
	currentPresetId: string | null;
	isPlaying: boolean;
	isEditingPreset: boolean;
	lastCycleTime: number;
	cycleInterval: number; // milliseconds
	hasUnsavedChanges: boolean;
	lastAppliedOptions: MotionDetectionOptions | null;
}