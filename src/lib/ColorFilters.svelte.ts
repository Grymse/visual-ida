
export class ColorFilters {
	private intervalId: number | null = null;
	private intervalDuration = 30000; // 30 seconds
	public filters = $state('sepia(1) saturate(3) hue-rotate(80deg) saturate(3)');

	start() {
		// Start the interval to update filters
		this.intervalId = setInterval(() => {
			const hueRotateValue = Math.floor(Math.random() * 360);
			if (Math.random() < 0.15) {
				this.filters = `sepia(0) saturate(0) hue-rotate(${hueRotateValue}deg) saturate(0)`;
			} else {
				this.filters = `sepia(1) saturate(3) hue-rotate(${hueRotateValue}deg) saturate(3)`;
			}
		}, this.intervalDuration);
	}

	destroy() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	get transitionDuration() {
		return this.intervalDuration;
	}
}