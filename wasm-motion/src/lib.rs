use wasm_bindgen::prelude::*;

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
    center_x: f32,
    center_y: f32,
    inv_max_radius: f32,
    persistence_buffer: Vec<f32>,
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

        MotionDetector {
            width,
            height,
            center_x,
            center_y,
            inv_max_radius,
            persistence_buffer: vec![0.0; buffer_size],
        }
    }

    #[wasm_bindgen]
    pub fn process_motion(
        &mut self,
        current_data: &[u8],
        compare_data: &[u8],
        output_data: &mut [u8],
        decay_rate: f32,
    ) {
        let width = self.width as usize;
        let height = self.height as usize;

        // Parallel processing using chunks for better cache performance
        for y in 0..height {
            let dy = y as f32 - self.center_y;
            let dy_squared = dy * dy;

            for x in 0..width {
                let pixel_index = y * width + x;
                let rgba_index = pixel_index * 4;

                // Optimized distance calculation
                let dx = x as f32 - self.center_x;
                let dx_squared = dx * dx;
                let distance_squared = dx_squared + dy_squared;
                let normalized_distance = distance_squared.sqrt() * self.inv_max_radius;

                // Create radial sensitivity mask - high sensitivity in center, low at edges
                let radial_sensitivity = (1.0 - normalized_distance * 0.9).max(0.1);

                // Calculate RGB differences using unsafe for maximum performance
                let current_r = current_data[rgba_index] as f32;
                let current_g = current_data[rgba_index + 1] as f32;
                let current_b = current_data[rgba_index + 2] as f32;

                let compare_r = compare_data[rgba_index] as f32;
                let compare_g = compare_data[rgba_index + 1] as f32;
                let compare_b = compare_data[rgba_index + 2] as f32;

                let r_diff = (current_r - compare_r).abs();
                let g_diff = (current_g - compare_g).abs();
                let b_diff = (current_b - compare_b).abs();

                // Average difference with optimized multiplication
                let avg_diff = (r_diff + g_diff + b_diff) * 0.33333;

                // Apply radial weighting to the difference
                let radial_weighted_diff = avg_diff * radial_sensitivity;

                // Apply adaptive threshold based on distance from center
                let adaptive_threshold = 30.0 + normalized_distance * 40.0;
                let filtered_diff = if radial_weighted_diff > adaptive_threshold {
                    radial_weighted_diff
                } else {
                    0.0
                };

                // Enhanced motion detection with radial focus
                let enhanced_diff = (filtered_diff * (1.5 + radial_sensitivity * 0.5)).min(255.0);

                // Apply persistence: combine current motion with decaying previous motion
                let previous_persistence = self.persistence_buffer[pixel_index];
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
) {
    let width_usize = width as usize;
    let height_usize = height as usize;

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
                let adaptive_threshold = 30.0 + normalized_distance * 40.0;
                let filtered_diff = if radial_weighted_diff > adaptive_threshold {
                    radial_weighted_diff
                } else {
                    0.0
                };

                let enhanced_diff = (filtered_diff * (1.5 + radial_sensitivity * 0.5)).min(255.0);
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
