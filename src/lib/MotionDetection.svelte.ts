
export interface MotionDetectionOptions {
	motionDecayRate: number;
	movementAngle: number;
	movementSpeed: number;
	motionThreshold: number;
	motionSensitivity: number;
}

export interface MotionDetectionState {
	isActive: boolean;
	hasError: boolean;
	errorMessage: string | null;
	fps: number;
	computeTime: number;
}

export class MotionDetection {
	private videoElement: HTMLVideoElement | null = null;
	private canvasElement: HTMLCanvasElement | null = null;
	private animationFrameId: number = 0;
	private timeoutId: number = 0;
	private previousImageData: ImageData | null = null;
	private framesInCurrentSecond: number = 0;
	private timeOfFrameSecond: number = 0;
	private frameInterval: number = 1000 / 20; // 50ms for 20 FPS
	
	// WebAssembly
	private MotionDetector: any = null;
	private motionDetector: any = null;
	
	// State
	private _state = $state<MotionDetectionState>({
		isActive: false,
		hasError: false,
		errorMessage: null,
		fps: 0,
		computeTime: 0
	});

	// Options - using runes for reactivity
	private _options = $state<MotionDetectionOptions>({
		motionDecayRate: 0.8,
		movementAngle: 280,
		movementSpeed: 40,
		motionThreshold: 30,
		motionSensitivity: 1.5
	});

	constructor() {}

	// Getters for reactive state
	get state() {
		return this._state;
	}

	get options() {
		return this._options;
	}

	// Initialize WebAssembly
	async setupWasm() {
		const getMotionDetector = () => {
			if ((window as any).wasmLoaded && (window as any).WasmMotionDetector) {
				console.log('✅ Using globally loaded WebAssembly module');
				return (window as any).WasmMotionDetector;
			}
			return null;
		};

		// Wait up to 2 seconds for WASM to load
		let attempts = 0;
		const maxAttempts = 20;
		const interval = setInterval(() => {
			attempts++;
			const MotionDetector = getMotionDetector();
			if (MotionDetector) {
				this.MotionDetector = MotionDetector;
				clearInterval(interval);
			} else if (attempts >= maxAttempts) {
				clearInterval(interval);
				console.error('Failed to load WebAssembly module after multiple attempts');
				this._state.hasError = true;
				this._state.errorMessage = 'Failed to load WebAssembly module';
				return;
			}
		}, 100);
	}

	// Start motion detection
	start(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): boolean {
		this.videoElement = videoElement;
		this.canvasElement = canvasElement;
		this._state.hasError = false;
		this._state.errorMessage = null;
		
		if (!this.videoElement || !this.canvasElement) {
			console.warn('Video or canvas element not ready');
			this._state.hasError = true;
			this._state.errorMessage = 'Video or canvas element not ready';
			return false;
		}

		console.log('Starting motion detection...');
		this._state.isActive = true;
		this._state.hasError = false;
		this._state.errorMessage = null;

		// Set up canvas dimensions to match video
		const ctx = this.canvasElement.getContext('2d');
		if (!ctx) {
			console.error('Could not get canvas context');
			this._state.hasError = true;
			this._state.errorMessage = 'Could not get canvas context';
			return false;
		}

		this.canvasElement.width = this.videoElement.videoWidth || 640;
		this.canvasElement.height = this.videoElement.videoHeight || 480;
		
		// Initialize motion detector if using WASM
		if (this.MotionDetector && !this.motionDetector) {
			try {
				this.motionDetector = new this.MotionDetector(
					this.canvasElement.width, 
					this.canvasElement.height
				);
				console.log('✅ WASM Motion detector initialized');
			} catch (error) {
				console.error('Failed to initialize WASM motion detector:', error);
				this._state.hasError = true;
				this._state.errorMessage = 'Failed to initialize WASM motion detector';
				return false;
			}
		}
		// Reset state
		this.previousImageData = null;

		// Start the motion detection loop
		this.processMotionDetection();
		return true;
	}

	private countFrames() {
		if (!this._state.isActive) return;
		this.framesInCurrentSecond++;
		const now = Date.now();
		if (now - this.timeOfFrameSecond >= 1000) {
			this._state.fps = this.framesInCurrentSecond;
			this.framesInCurrentSecond = 0;
			this.timeOfFrameSecond = now;
		}
	}

	// Stop motion detection
	stop() {
		console.log('Stopping motion detection...');
		this._state.isActive = false;

		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = 0;
		}

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = 0;
		}

		// Clean up WASM resources
		if (this.motionDetector && this.motionDetector.free) {
			this.motionDetector.free();
			this.motionDetector = null;
		}

		// Reset state
		this.previousImageData = null;
		this._state.hasError = false;
		this._state.errorMessage = null;
	}

	// Process motion detection frame
	private processMotionDetection() {
		if (!this._state.isActive || !this.videoElement || !this.canvasElement) {
			return;
		}

		const ctx = this.canvasElement.getContext('2d');
		if (!ctx) {
			console.error('Could not get canvas context');
			this._state.hasError = true;
			this._state.errorMessage = 'Could not get canvas context';
			return;
		}

		const before = Date.now();
		try {
			// Draw current video frame to canvas
			ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
			const currentImageData = ctx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);

			if (this.previousImageData) {
				// Process motion detection
				const outputImageData = ctx.createImageData(this.canvasElement.width, this.canvasElement.height);
				if (this.motionDetector) {
					try {
						this.motionDetector.process_motion_with_movement(
							currentImageData.data,
							this.previousImageData.data,
							outputImageData.data,
							{
								decay_rate: this._options.motionDecayRate,
								angle_radians: this._options.movementAngle * (Math.PI / 180), // Convert degrees to radians
								speed: this._options.movementSpeed,
								threshold: this._options.motionThreshold,
								sensitivity: this._options.motionSensitivity
							}
						);
					} catch (error) {
						console.error('WASM motion detection error:', error);
						this._state.hasError = true;
						this._state.errorMessage = `WASM motion detection error: ${error}`;
						return;
					}
				} else {
					console.error("WASM motion detector not initialized, no update available");
				}

				// Apply output to canvas
				ctx.putImageData(outputImageData, 0, 0);
			}

			// Store current frame for next comparison
			this.previousImageData = currentImageData;
			// Count frames for FPS calculation
			this.countFrames();
			// Update compute time
			this._state.computeTime = Date.now() - before;

			// Schedule next frame at fixed framerate
			if (this._state.isActive) {
				const timeTillNextFrame = Math.max(this.frameInterval - this._state.computeTime, 0);
				this.timeoutId = setTimeout(() => this.processMotionDetection(), timeTillNextFrame);
			}
		} catch (error) {
			console.error('Motion detection processing error:', error);
			this._state.hasError = true;
			this._state.errorMessage = `Motion detection processing error: ${error}`;
		}
	}

	// Cleanup method
	destroy() {
		this.stop();
		this.videoElement = null;
		this.canvasElement = null;
	}
}

// Export a singleton instance
export default MotionDetection;
