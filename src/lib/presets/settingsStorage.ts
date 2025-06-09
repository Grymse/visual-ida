export interface PresetSettings {
	transitionDuration: number;
	cycleDuration: number;
	colorIntervalDuration: number;
}

const SETTINGS_STORAGE_KEY = 'visual-ida-preset-settings';

export class SettingsStorage {
	private static defaultSettings: PresetSettings = {
		transitionDuration: 3000, // 3 seconds
		cycleDuration: 30000, // 30 seconds
		colorIntervalDuration: 30000 // 30 seconds for color interval changes
	};

	static save(settings: PresetSettings): void {
		try {
			const serialized = JSON.stringify(settings);
			localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
		} catch (error) {
			console.warn('Failed to save preset settings to localStorage:', error);
		}
	}

	static load(): PresetSettings {
		try {
			const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
			if (!stored) {
				return { ...this.defaultSettings };
			}

			const parsed = JSON.parse(stored);
			
			// Validate and merge with defaults
			return {
				transitionDuration: typeof parsed.transitionDuration === 'number' ? parsed.transitionDuration : this.defaultSettings.transitionDuration,
				cycleDuration: typeof parsed.cycleDuration === 'number' ? parsed.cycleDuration : this.defaultSettings.cycleDuration,
				colorIntervalDuration: typeof parsed.colorIntervalDuration === 'number' ? parsed.colorIntervalDuration : this.defaultSettings.colorIntervalDuration
			};
		} catch (error) {
			console.warn('Failed to load preset settings from localStorage:', error);
			return { ...this.defaultSettings };
		}
	}

	static clear(): void {
		try {
			localStorage.removeItem(SETTINGS_STORAGE_KEY);
		} catch (error) {
			console.warn('Failed to clear preset settings from localStorage:', error);
		}
	}
}