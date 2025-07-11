/* tslint:disable */
/* eslint-disable */
export class MotionDetector {
  free(): void;
  constructor(width: number, height: number);
  process_motion_with_cache(current_data: Uint8Array, output_data: Uint8Array, options: any): void;
  move_in_direction(options: any): void;
  move_radially(options: any): void;
  move_spiral(options: any): void;
  move_wave(options: any): void;
  reset_persistence(): void;
  reset_all_state(): void;
  get_buffer_size(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_motiondetector_free: (a: number, b: number) => void;
  readonly motiondetector_new: (a: number, b: number) => number;
  readonly motiondetector_process_motion_with_cache: (a: number, b: number, c: number, d: number, e: number, f: any, g: any) => void;
  readonly motiondetector_move_in_direction: (a: number, b: any) => void;
  readonly motiondetector_move_radially: (a: number, b: any) => void;
  readonly motiondetector_move_spiral: (a: number, b: any) => void;
  readonly motiondetector_move_wave: (a: number, b: any) => void;
  readonly motiondetector_reset_persistence: (a: number) => void;
  readonly motiondetector_reset_all_state: (a: number) => void;
  readonly motiondetector_get_buffer_size: (a: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
