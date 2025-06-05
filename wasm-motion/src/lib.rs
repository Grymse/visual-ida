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
    // Optimization #6: Cache previous frame in Rust (50% less data transfer)
    previous_frame_cache: Vec<u8>,
    is_first_frame: bool,
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
            previous_frame_cache: Vec::with_capacity(buffer_size * 4), // RGBA cache
            is_first_frame: true,
        }
    }

    #[wasm_bindgen]
    pub fn process_motion_with_cache(
        &mut self,
        current_data: &[u8],    // Only current frame - 50% less data transfer!
        output_data: &mut [u8], // RGBA output for display
        options: JsValue,
    ) {
        let width = self.width as usize;
        let height = self.height as usize;
        let pixel_count = width * height;

        // First frame: just cache and return
        if self.is_first_frame {
            self.previous_frame_cache.clear();
            self.previous_frame_cache.extend_from_slice(current_data);
            self.is_first_frame = false;

            // Output black frame for first frame
            for i in 0..output_data.len() {
                output_data[i] = if i % 4 == 3 { 255 } else { 0 }; // Set alpha to 255, RGB to 0
            }
            return;
        }

        // Extract parameters
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

        let threshold = js_sys::Reflect::get(&options, &"threshold".into())
            .unwrap_or(JsValue::from(30.0))
            .as_f64()
            .unwrap_or(30.0) as f32;

        let sensitivity = js_sys::Reflect::get(&options, &"sensitivity".into())
            .unwrap_or(JsValue::from(1.0))
            .as_f64()
            .unwrap_or(1.0) as f32;

        // Movement processing
        let move_x = angle_radians.cos() * speed;
        let move_y = angle_radians.sin() * speed;

        self.temp_buffer.clear();
        self.temp_buffer.resize(self.persistence_buffer.len(), 0.0);

        // Apply movement (same as before)
        if speed > 1.0 {
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
        } else {
            self.temp_buffer.copy_from_slice(&self.persistence_buffer);
        }

        // Process motion using cached previous frame vs current frame
        for pixel_index in 0..pixel_count {
            let rgba_index = pixel_index * 4;

            // Fast grayscale conversion using integer arithmetic
            let current_gray = ((current_data[rgba_index] as u32 * 77)
                + (current_data[rgba_index + 1] as u32 * 150)
                + (current_data[rgba_index + 2] as u32 * 29))
                >> 8;

            let previous_gray = ((self.previous_frame_cache[rgba_index] as u32 * 77)
                + (self.previous_frame_cache[rgba_index + 1] as u32 * 150)
                + (self.previous_frame_cache[rgba_index + 2] as u32 * 29))
                >> 8;

            // Use pre-computed lookup tables
            let normalized_distance = self.distance_lut[pixel_index];
            let radial_sensitivity = self.radial_sensitivity_lut[pixel_index];

            // Motion detection with grayscale values
            let diff = (current_gray as f32 - previous_gray as f32).abs();
            let radial_weighted_diff = diff * radial_sensitivity;
            let adaptive_threshold = threshold + normalized_distance * 40.0;

            let filtered_diff = if radial_weighted_diff > adaptive_threshold {
                radial_weighted_diff
            } else {
                0.0
            };

            let enhanced_diff =
                (filtered_diff * (sensitivity + radial_sensitivity * 0.5)).min(255.0);

            // Apply persistence
            let previous_persistence = self.temp_buffer[pixel_index];
            let persisted_motion = enhanced_diff.max(previous_persistence * decay_rate);

            // Update persistence buffer
            self.persistence_buffer[pixel_index] = persisted_motion;

            // Output as grayscale RGBA for display
            let smoothed_motion = persisted_motion.min(255.0) as u8;
            output_data[rgba_index] = smoothed_motion;
            output_data[rgba_index + 1] = smoothed_motion;
            output_data[rgba_index + 2] = smoothed_motion;
            output_data[rgba_index + 3] = 255;
        }

        // Update cache with current frame for next iteration
        self.previous_frame_cache.copy_from_slice(current_data);
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
