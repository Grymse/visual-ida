import type { MotionDetectionPreset } from './types';

const STORAGE_KEY = 'motion-detection-presets';

export class PresetStorage {
	static save(presets: MotionDetectionPreset[]): void {
		try {
			const serialized = JSON.stringify(presets, (key, value) => {
				// Convert Date objects to ISO strings
				if (value instanceof Date) {
					return value.toISOString();
				}
				return value;
			});
			localStorage.setItem(STORAGE_KEY, serialized);
		} catch (error) {
			console.error('Failed to save presets to localStorage:', error);
		}
	}

	static load(): MotionDetectionPreset[] {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) return [];

			const parsed = JSON.parse(stored);
			// Convert ISO strings back to Date objects
			return parsed.map((preset: any) => ({
				...preset,
				createdAt: new Date(preset.createdAt),
				updatedAt: new Date(preset.updatedAt)
			}));
		} catch (error) {
			console.error('Failed to load presets from localStorage:', error);
			return [];
		}
	}

	static clear(): void {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (error) {
			console.error('Failed to clear presets from localStorage:', error);
		}
	}
}