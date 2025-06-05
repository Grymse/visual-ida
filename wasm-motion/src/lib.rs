use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

// Import the `console.log` function from the `console` module for debugging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro for console logging
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct MotionDetector {
    width: u32,
    height: u32,
    persistence_buffer: Vec<f32>,
    // Optimization #1: Pre-computed lookup tables
    distance_lut: Vec<f32>,
    radial_sensitivity_lut: Vec<f32>,
    // Optimization #2: Reusable buffer to avoid allocations
    temp_buffer: Vec<f32>,
}

#[wasm_bindgen]
impl MotionDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> MotionDetector {
        let center_x = width as f32 / 2.0;
        let center_y = height as f32 / 2.0;
        let max_radius = ((center_x * center_x) + (center_y * center_y)).sqrt();
        let inv_max_radius = 1.0 / max_radius;
        let buffer_size = (width * height) as usize;

        // Pre-compute distance and radial sensitivity lookup tables
        let mut distance_lut = Vec::with_capacity(buffer_size);
        let mut radial_sensitivity_lut = Vec::with_capacity(buffer_size);

        for y in 0..height {
            for x in 0..width {
                let dx = x as f32 - center_x;
                let dy = y as f32 - center_y;
                let distance_squared = dx * dx + dy * dy;
                let normalized_distance = distance_squared.sqrt() * inv_max_radius;
                let radial_sensitivity = (1.0 - normalized_distance * 0.9).max(0.1);

                distance_lut.push(normalized_distance);
                radial_sensitivity_lut.push(radial_sensitivity);
            }
        }

        MotionDetector {
            width,
            height,
            persistence_buffer: vec![0.0; buffer_size],
            distance_lut,
            radial_sensitivity_lut,
            temp_buffer: Vec::with_capacity(buffer_size),
        }
    }

    #[wasm_bindgen]
    pub fn process_motion_with_movement(
        &mut self,
        current_data: &[u8],
        compare_data: &[u8],
        output_data: &mut [u8],
        options: JsValue,
    ) {
        let width = self.width as usize;
        let height = self.height as usize;

        // Extract values from the JavaScript object
        let decay_rate = js_sys::Reflect::get(&options, &"decay_rate".into())
            .unwrap_or(JsValue::from(0.95))
            .as_f64()
            .unwrap_or(0.95) as f32;

        let angle_radians = js_sys::Reflect::get(&options, &"angle_radians".into())
            .unwrap_or(JsValue::from(0.0))
            .as_f64()
            .unwrap_or(0.0) as f32;

        let speed = js_sys::Reflect::get(&options, &"speed".into())
            .unwrap_or(JsValue::from(0.0))
            .as_f64()
            .unwrap_or(0.0) as f32;

        // Extract values from the JavaScript object
        let threshold = js_sys::Reflect::get(&options, &"threshold".into())
            .unwrap_or(JsValue::from(0.95))
            .as_f64()
            .unwrap_or(0.95) as f32;

        // Extract values from the JavaScript object
        let sensitivity = js_sys::Reflect::get(&options, &"sensitivity".into())
            .unwrap_or(JsValue::from(0.95))
            .as_f64()
            .unwrap_or(0.95) as f32;

        // Calculate movement offset
        let move_x = angle_radians.cos() * speed;
        let move_y = angle_radians.sin() * speed;

        // Reuse temp_buffer instead of allocating (Optimization #2)
        self.temp_buffer.clear();
        self.temp_buffer.resize(self.persistence_buffer.len(), 0.0);

        // Apply movement to the persistence buffer if speed > 0
        if speed > 1.0 {
            // Optimization #3: Use simplified movement for higher speeds (better performance)
            let move_x_int = move_x.round() as i32;
            let move_y_int = move_y.round() as i32;

            for pixel_index in 0..self.persistence_buffer.len() {
                let x = (pixel_index % width) as i32;
                let y = (pixel_index / width) as i32;

                let source_x = x - move_x_int;
                let source_y = y - move_y_int;

                if source_x >= 0
                    && source_x < width as i32
                    && source_y >= 0
                    && source_y < height as i32
                {
                    let source_index = (source_y as usize * width) + source_x as usize;
                    self.temp_buffer[pixel_index] = self.persistence_buffer[source_index];
                }
            }
        } else if speed > 0.0 {
            // Use bilinear interpolation for low speeds (better quality)
            for y in 0..height {
                for x in 0..width {
                    let source_x = x as f32 - move_x;
                    let source_y = y as f32 - move_y;

                    // Check if the source coordinates are within bounds
                    if source_x >= 0.0
                        && source_x < width as f32
                        && source_y >= 0.0
                        && source_y < height as f32
                    {
                        let source_x_int = source_x as usize;
                        let source_y_int = source_y as usize;

                        // Bilinear interpolation for smoother movement
                        let fx = source_x - source_x_int as f32;
                        let fy = source_y - source_y_int as f32;

                        let source_index = source_y_int * width + source_x_int;
                        let target_index = y * width + x;

                        // Get the four surrounding pixels for interpolation
                        let val_00 = if source_x_int < width && source_y_int < height {
                            self.persistence_buffer[source_index]
                        } else {
                            0.0
                        };

                        let val_10 = if source_x_int + 1 < width && source_y_int < height {
                            self.persistence_buffer[source_index + 1]
                        } else {
                            0.0
                        };

                        let val_01 = if source_x_int < width && source_y_int + 1 < height {
                            self.persistence_buffer[source_index + width]
                        } else {
                            0.0
                        };

                        let val_11 = if source_x_int + 1 < width && source_y_int + 1 < height {
                            self.persistence_buffer[source_index + width + 1]
                        } else {
                            0.0
                        };

                        // Bilinear interpolation
                        let val_0 = val_00 * (1.0 - fx) + val_10 * fx;
                        let val_1 = val_01 * (1.0 - fx) + val_11 * fx;
                        let interpolated_val = val_0 * (1.0 - fy) + val_1 * fy;

                        self.temp_buffer[target_index] = interpolated_val;
                    }
                }
            }
        } else {
            // No movement, copy the original buffer
            self.temp_buffer.copy_from_slice(&self.persistence_buffer);
        }

        // Processing loop with optimized cache locality (Optimization #4)
        for pixel_index in 0..width * height {
            let rgba_index = pixel_index * 4;

            // Use pre-computed values from lookup tables (Optimization #1)
            let normalized_distance = self.distance_lut[pixel_index];
            let radial_sensitivity = self.radial_sensitivity_lut[pixel_index];

            // Vectorized RGB difference calculation for better performance
            let current_rgb = [
                current_data[rgba_index] as f32,
                current_data[rgba_index + 1] as f32,
                current_data[rgba_index + 2] as f32,
            ];

            let compare_rgb = [
                compare_data[rgba_index] as f32,
                compare_data[rgba_index + 1] as f32,
                compare_data[rgba_index + 2] as f32,
            ];

            // Calculate average difference more efficiently
            let avg_diff = current_rgb
                .iter()
                .zip(compare_rgb.iter())
                .map(|(c, p)| (c - p).abs())
                .sum::<f32>()
                * 0.33333;

            // Apply radial weighting to the difference
            let radial_weighted_diff = avg_diff * radial_sensitivity;

            // Apply adaptive threshold based on distance from center
            let adaptive_threshold = threshold + normalized_distance * 40.0;
            let filtered_diff = if radial_weighted_diff > adaptive_threshold {
                radial_weighted_diff
            } else {
                0.0
            };

            // Enhanced motion detection with radial focus
            let enhanced_diff =
                (filtered_diff * (sensitivity + radial_sensitivity * 0.5)).min(255.0);

            // Apply persistence: combine current motion with decaying previous motion
            let previous_persistence = self.temp_buffer[pixel_index];
            let persisted_motion = enhanced_diff.max(previous_persistence * decay_rate);

            // Update persistence buffer
            self.persistence_buffer[pixel_index] = persisted_motion;

            // Apply temporal smoothing and convert to u8
            let smoothed_motion = persisted_motion.min(255.0) as u8;

            // Set the output as grayscale RGBA
            output_data[rgba_index] = smoothed_motion;
            output_data[rgba_index + 1] = smoothed_motion;
            output_data[rgba_index + 2] = smoothed_motion;
            output_data[rgba_index + 3] = 255;
        }
    }

    #[wasm_bindgen]
    pub fn reset_persistence(&mut self) {
        for val in &mut self.persistence_buffer {
            *val = 0.0;
        }
    }

    #[wasm_bindgen]
    pub fn get_buffer_size(&self) -> usize {
        self.persistence_buffer.len()
    }
}

// Fast SIMD-optimized version for supported browsers
#[wasm_bindgen]
pub fn process_motion_simd(
    current_data: &[u8],
    compare_data: &[u8],
    output_data: &mut [u8],
    persistence_buffer: &mut [f32],
    width: u32,
    height: u32,
    center_x: f32,
    center_y: f32,
    inv_max_radius: f32,
    decay_rate: f32,
    options: JsValue,
) {
    let width_usize = width as usize;
    let height_usize = height as usize;

    // Extract values from the JavaScript object
    let threshold = js_sys::Reflect::get(&options, &"threshold".into())
        .unwrap_or(JsValue::from(0.95))
        .as_f64()
        .unwrap_or(0.95) as f32;

    // Extract values from the JavaScript object
    let sensitivty = js_sys::Reflect::get(&options, &"sensitivty".into())
        .unwrap_or(JsValue::from(0.95))
        .as_f64()
        .unwrap_or(0.95) as f32;

    for y in 0..height_usize {
        let dy = y as f32 - center_y;
        let dy_squared = dy * dy;

        // Process 4 pixels at a time for better vectorization
        let mut x = 0;
        while x < width_usize {
            let pixels_remaining = (width_usize - x).min(4);

            for i in 0..pixels_remaining {
                let current_x = x + i;
                let pixel_index = y * width_usize + current_x;
                let rgba_index = pixel_index * 4;

                let dx = current_x as f32 - center_x;
                let dx_squared = dx * dx;
                let distance_squared = dx_squared + dy_squared;
                let normalized_distance = distance_squared.sqrt() * inv_max_radius;

                let radial_sensitivity = (1.0 - normalized_distance * 0.9).max(0.1);

                // Vectorized RGB difference calculation
                let current_r = current_data[rgba_index] as f32;
                let current_g = current_data[rgba_index + 1] as f32;
                let current_b = current_data[rgba_index + 2] as f32;

                let compare_r = compare_data[rgba_index] as f32;
                let compare_g = compare_data[rgba_index + 1] as f32;
                let compare_b = compare_data[rgba_index + 2] as f32;

                let avg_diff = ((current_r - compare_r).abs()
                    + (current_g - compare_g).abs()
                    + (current_b - compare_b).abs())
                    * 0.33333;

                let radial_weighted_diff = avg_diff * radial_sensitivity;
                let adaptive_threshold = threshold + normalized_distance * 40.0;
                let filtered_diff = if radial_weighted_diff > adaptive_threshold {
                    radial_weighted_diff
                } else {
                    0.0
                };

                let enhanced_diff =
                    (filtered_diff * (sensitivty + radial_sensitivity * 0.5)).min(255.0);
                let persisted_motion =
                    enhanced_diff.max(persistence_buffer[pixel_index] * decay_rate);

                persistence_buffer[pixel_index] = persisted_motion;
                let smoothed_motion = persisted_motion.min(255.0) as u8;

                output_data[rgba_index] = smoothed_motion;
                output_data[rgba_index + 1] = smoothed_motion;
                output_data[rgba_index + 2] = smoothed_motion;
                output_data[rgba_index + 3] = 255;
            }

            x += 4;
        }
    }
}
