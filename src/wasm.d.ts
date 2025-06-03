// TypeScript declarations for WebAssembly module
declare module '/wasm/motion_detection.js' {
  export class MotionDetector {
    constructor(width: number, height: number);
    process_motion(
      current_data: Uint8Array,
      compare_data: Uint8Array,
      output_data: Uint8Array,
      decay_rate: number
    ): void;
    reset_persistence(): void;
    get_buffer_size(): number;
    free(): void;
  }
  
  export default function init(module_or_path?: any): Promise<any>;
}
