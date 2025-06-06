export class AnimateAngleChange {
	private angleAnimationTimeout: ReturnType<typeof setTimeout> | null = null;
	private angleAnimationFrame: number | null = null;
	private angleAnimationStart = 0;
	private angleAnimationDuration = 0;
	private angleAnimationFrom = 0;
	private angleAnimationTo = 0;
	private updateAngleCallback: (angle: number) => void;

	constructor(updateAngleCallback: (angle: number) => void) {
		this.updateAngleCallback = updateAngleCallback;
	}

	private animateAngleChange = () => {
		// Animate movementAngle from angleAnimationFrom to angleAnimationTo over angleAnimationDuration ms
		const now = performance.now();
		const elapsed = now - this.angleAnimationStart;
		const t = Math.min(elapsed / this.angleAnimationDuration, 1);
		const currentAngle = this.angleAnimationFrom + (this.angleAnimationTo - this.angleAnimationFrom) * t;
		
		// Update the motion detection angle via callback
		this.updateAngleCallback(currentAngle);

		if (t < 1) {
			this.angleAnimationFrame = requestAnimationFrame(this.animateAngleChange);
		} else {
			this.updateAngleCallback(this.angleAnimationTo);
			this.angleAnimationFrame = null;
			this.scheduleNextAngleChange();
		}
	};

	private scheduleNextAngleChange = () => {
		const delay = 2000 + Math.random() * 5000; // 5-15 seconds
		this.angleAnimationTimeout = setTimeout(() => {
			this.angleAnimationFrom = this.angleAnimationTo; // Use last target as new start
			this.angleAnimationTo = Math.floor(Math.random() * 361);
			this.angleAnimationStart = performance.now();
			this.angleAnimationDuration = 1000 + Math.random() * 10000; // 1.5-3s transition
			if (this.angleAnimationFrame) cancelAnimationFrame(this.angleAnimationFrame);
			this.angleAnimationFrame = requestAnimationFrame(this.animateAngleChange);
		}, delay);
	};

	start(initialAngle: number = 0) {
		this.angleAnimationFrom = initialAngle;
		this.angleAnimationTo = initialAngle;
		this.scheduleNextAngleChange();
	}

	destroy() {
		if (this.angleAnimationTimeout) clearTimeout(this.angleAnimationTimeout);
		if (this.angleAnimationFrame) cancelAnimationFrame(this.angleAnimationFrame);
	}
}