import type { MotionDetectionOptions } from '../MotionDetection.svelte';

export class PresetTransitionManager {
	private isTransitioning = false;
	private transitionStartTime = 0;
	private transitionDuration = 3000; // 3 seconds
	private startValues: MotionDetectionOptions | null = null;
	private targetValues: MotionDetectionOptions | null = null;
	private animationFrame: number | null = null;
	private updateCallback?: (options: MotionDetectionOptions) => void;
	private onDurationChangeCallback?: () => void;

	constructor(updateCallback?: (options: MotionDetectionOptions) => void, onDurationChange?: () => void) {
		this.updateCallback = updateCallback;
		this.onDurationChangeCallback = onDurationChange;
	}

	// Start a transition from current values to target values
	startTransition(
		currentValues: MotionDetectionOptions, 
		targetValues: MotionDetectionOptions
	): void {
		// Cancel any existing transition
		this.cancelTransition();

		// Store the start and target values
		this.startValues = { ...currentValues };
		this.targetValues = { ...targetValues };
		
		// Apply immediate changes (no transition for these binary/discrete values)
		const immediateUpdate = { ...currentValues };
		let hasImmediateChanges = false;

		if (this.startValues.moveType !== this.targetValues.moveType) {
			immediateUpdate.moveType = targetValues.moveType;
			this.startValues.moveType = targetValues.moveType; // Update start value too
			hasImmediateChanges = true;
		}

		if (this.startValues.waveDirection !== this.targetValues.waveDirection) {
			immediateUpdate.waveDirection = targetValues.waveDirection;
			this.startValues.waveDirection = targetValues.waveDirection; // Update start value too
			hasImmediateChanges = true;
		}

		// Apply immediate changes if any
		if (this.updateCallback && hasImmediateChanges) {
			this.updateCallback(immediateUpdate);
		}

		// Start the transition
		this.isTransitioning = true;
		this.transitionStartTime = performance.now();
		this.animate();
	}

	// Cancel the current transition
	cancelTransition(): void {
		this.isTransitioning = false;
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
	}

	// Check if currently transitioning
	get transitioning(): boolean {
		return this.isTransitioning;
	}

	// Linear interpolation between two values
	private lerp(start: number, end: number, t: number): number {
		return start + (end - start) * t;
	}

	// Easing function for smoother transitions (ease-in-out)
	private easeInOut(t: number): number {
		return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
	}

	// Animation loop
	private animate = (): void => {
		if (!this.isTransitioning || !this.startValues || !this.targetValues) {
			return;
		}

		const elapsed = performance.now() - this.transitionStartTime;
		const rawProgress = Math.min(elapsed / this.transitionDuration, 1);
		const progress = this.easeInOut(rawProgress); // Apply easing

		// Interpolate all numeric values
		const interpolatedValues: MotionDetectionOptions = {
			moveType: this.targetValues.moveType, // Already applied immediately
			waveDirection: this.targetValues.waveDirection, // Already applied immediately
			motionDecayRate: this.lerp(this.startValues.motionDecayRate, this.targetValues.motionDecayRate, progress),
			movementAngle: this.lerp(this.startValues.movementAngle, this.targetValues.movementAngle, progress),
			movementSpeed: this.lerp(this.startValues.movementSpeed, this.targetValues.movementSpeed, progress),
			motionThreshold: this.lerp(this.startValues.motionThreshold, this.targetValues.motionThreshold, progress),
			motionSensitivity: this.lerp(this.startValues.motionSensitivity, this.targetValues.motionSensitivity, progress),
			rotationSpeed: this.lerp(this.startValues.rotationSpeed, this.targetValues.rotationSpeed, progress),
			waveAmplitude: this.lerp(this.startValues.waveAmplitude, this.targetValues.waveAmplitude, progress),
			waveFrequency: this.lerp(this.startValues.waveFrequency, this.targetValues.waveFrequency, progress),
			wavePhase: this.lerp(this.startValues.wavePhase, this.targetValues.wavePhase, progress)
		};

		// Update the motion detection with interpolated values
		if (this.updateCallback) {
			this.updateCallback(interpolatedValues);
		}

		// Continue animation or finish
		if (rawProgress < 1) {
			this.animationFrame = requestAnimationFrame(this.animate);
		} else {
			// Transition complete
			this.isTransitioning = false;
			this.animationFrame = null;
			
			// Ensure final values are exactly the target values
			if (this.updateCallback) {
				this.updateCallback(this.targetValues);
			}
		}
	};

	// Set transition duration
	setDuration(durationMs: number): void {
		this.transitionDuration = Math.max(100, durationMs); // Minimum 100ms
		if (this.onDurationChangeCallback) {
			this.onDurationChangeCallback();
		}
	}

	// Get current transition duration
	get duration(): number {
		return this.transitionDuration;
	}

	// Apply options immediately without transition
	applyImmediately(options: MotionDetectionOptions): void {
		this.cancelTransition();
		if (this.updateCallback) {
			this.updateCallback(options);
		}
	}

	// Cleanup
	destroy(): void {
		this.cancelTransition();
	}
}