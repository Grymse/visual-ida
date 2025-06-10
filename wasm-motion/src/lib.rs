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
    // Optimization for spiral movement: Pre-computed polar coordinates
    polar_angle_lut: Vec<f32>,
    polar_distance_lut: Vec<f32>,
    // Optimization #3: Pre-computed squared distances for fast comparisons
    polar_distance_squared_lut: Vec<f32>,
    // Optimization #2: Reusable buffer to avoid allocations
    temp_buffer: Vec<f32>,
    // Optimization #6: Cache previous frame in Rust (50% less data transfer)
    previous_frame_cache: Vec<u8>,
    is_first_frame: bool,
    phase: f32,
    // Optimization #6: Distance-based processing thresholds for approximation
    center_x: f32,
    center_y: f32,
    // Distance thresholds for different quality levels
    high_quality_radius: f32,
    medium_quality_radius: f32,
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

        // Pre-allocate all vectors with exact capacity to avoid reallocations
        let mut distance_lut = Vec::with_capacity(buffer_size);
        let mut radial_sensitivity_lut = Vec::with_capacity(buffer_size);
        let mut polar_angle_lut = Vec::with_capacity(buffer_size);
        let mut polar_distance_lut = Vec::with_capacity(buffer_size);
        let mut polar_distance_squared_lut = Vec::with_capacity(buffer_size);

        // Cache-friendly initialization: Process row by row to improve spatial locality
        for y in 0..height {
            let y_f32 = y as f32;
            let dy = y_f32 - center_y;

            for x in 0..width {
                let x_f32 = x as f32;
                let dx = x_f32 - center_x;
                let distance_squared = dx * dx + dy * dy;
                let distance = distance_squared.sqrt();
                let normalized_distance = distance * inv_max_radius;
                let radial_sensitivity = (1.0 - normalized_distance * 0.9).max(0.1);

                // Pre-compute polar coordinates for spiral movement
                let angle = dy.atan2(dx);

                distance_lut.push(normalized_distance);
                radial_sensitivity_lut.push(radial_sensitivity);
                polar_angle_lut.push(angle);
                polar_distance_lut.push(distance);
                polar_distance_squared_lut.push(distance_squared);
            }
        }

        MotionDetector {
            width,
            height,
            // Initialize persistence buffer with zero for better cache locality
            persistence_buffer: vec![0.0; buffer_size],
            distance_lut,
            radial_sensitivity_lut,
            polar_angle_lut,
            polar_distance_lut,
            polar_distance_squared_lut,
            // Pre-allocate temp buffer with exact capacity
            temp_buffer: Vec::with_capacity(buffer_size),
            // Pre-allocate frame cache with exact capacity (RGBA = 4 bytes per pixel)
            previous_frame_cache: Vec::with_capacity(buffer_size * 4),
            is_first_frame: true,
            phase: 0.0,
            // Optimization #6: Store center and radius for distance-based approximation
            center_x,
            center_y,
            // Define quality levels: high quality for center 30%, medium for next 40%, low for outer 30%
            high_quality_radius: max_radius * 0.3,
            medium_quality_radius: max_radius * 0.7,
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
        let move_type = js_sys::Reflect::get(&options, &"move_type".into())
            .unwrap_or(JsValue::from_str("direction"))
            .as_string()
            .unwrap_or_else(|| "direction".to_string());

        // Perform motion based on type
        match move_type.as_str() {
            "direction" => self.move_in_direction(options.clone()),
            "radial" => self.move_radially(options.clone()),
            "spiral" => self.move_spiral(options.clone()),
            "wave" => self.move_wave(options.clone()),
            _ => console_log!("Unknown move type: {}", move_type),
        }

        // Extract parameters
        let decay_rate = js_sys::Reflect::get(&options, &"decay_rate".into())
            .unwrap_or(JsValue::from(0.95))
            .as_f64()
            .unwrap_or(0.95) as f32;

        let threshold = js_sys::Reflect::get(&options, &"threshold".into())
            .unwrap_or(JsValue::from(30.0))
            .as_f64()
            .unwrap_or(30.0) as f32;

        let sensitivity = js_sys::Reflect::get(&options, &"sensitivity".into())
            .unwrap_or(JsValue::from(1.0))
            .as_f64()
            .unwrap_or(1.0) as f32;

        // Cache-friendly motion detection processing: Process in row-major order
        // This improves spatial locality for better cache utilization
        for y in 0..height {
            let row_base = y * width;

            for x in 0..width {
                let pixel_index = row_base + x;
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
        }

        // Update cache with current frame for next iteration
        self.previous_frame_cache.copy_from_slice(current_data);
    }

    pub fn move_in_direction(&mut self, options: JsValue) {
        let width = self.width as usize;
        let height = self.height as usize;

        let angle_radians = js_sys::Reflect::get(&options, &"angle_radians".into())
            .unwrap_or(JsValue::from(0.0))
            .as_f64()
            .unwrap_or(0.0) as f32;

        let speed = js_sys::Reflect::get(&options, &"speed".into())
            .unwrap_or(JsValue::from(0.0))
            .as_f64()
            .unwrap_or(0.0) as f32;

        self.temp_buffer.clear();
        self.temp_buffer.resize(self.persistence_buffer.len(), 0.0);

        // Early exit for minimal movement - avoid all calculations
        if speed <= 1.0 {
            self.temp_buffer.copy_from_slice(&self.persistence_buffer);
            return;
        }

        // Pre-compute movement values outside the loop
        let move_x = angle_radians.cos() * speed;
        let move_y = angle_radians.sin() * speed;
        let move_x_int = move_x.round() as i32;
        let move_y_int = move_y.round() as i32;

        // Cache-friendly processing: Process in row-major order with row-level optimizations
        let width_i32 = width as i32;
        let height_i32 = height as i32;

        // Process row by row for better cache locality
        for y in 0..height {
            let y_i32 = y as i32;
            let source_y = y_i32 - move_y_int;

            // Skip entire row if source_y is out of bounds
            if source_y < 0 || source_y >= height_i32 {
                // Row is out of bounds - temp_buffer already initialized to 0.0
                continue;
            }

            let source_row_base = (source_y as usize) * width;
            let dest_row_base = y * width;

            // Process pixels in this row with cache-friendly access pattern
            for x in 0..width {
                let x_i32 = x as i32;
                let source_x = x_i32 - move_x_int;

                if source_x >= 0 && source_x < width_i32 {
                    let source_index = source_row_base + source_x as usize;
                    let dest_index = dest_row_base + x;
                    self.temp_buffer[dest_index] = self.persistence_buffer[source_index];
                }
                // Implicit else: temp_buffer[dest_index] remains 0.0 from initialization
            }
        }
    }

    pub fn move_radially(&mut self, options: JsValue) {
        let width = self.width as usize;
        let height = self.height as usize;

        let speed = js_sys::Reflect::get(&options, &"speed".into())
            .unwrap_or(JsValue::from(0.0))
            .as_f64()
            .unwrap_or(0.0) as f32;

        self.temp_buffer.clear();
        self.temp_buffer.resize(self.persistence_buffer.len(), 0.0);

        // Radial movement processing - optimized to avoid expensive sqrt calls
        if speed.abs() > 0.1 {
            let speed_plus_threshold = speed + 50.0;
            let speed_plus_threshold_squared = speed_plus_threshold * speed_plus_threshold;
            let width_i32 = width as i32;
            let height_i32 = height as i32;

            // Cache-friendly processing: Process row by row for better memory locality
            for y in 0..height {
                let y_f32 = y as f32;
                let dy = y_f32 - self.center_y;
                let dest_row_base = y * width;

                for x in 0..width {
                    let pixel_index = dest_row_base + x;

                    // Use pre-computed squared distance to avoid sqrt calculation
                    let distance_squared = self.polar_distance_squared_lut[pixel_index];

                    if distance_squared > speed_plus_threshold_squared {
                        let distance = self.polar_distance_lut[pixel_index];

                        // Optimization #6: Distance-based approximation for performance
                        let effective_speed = if distance <= self.high_quality_radius {
                            // High quality: Full precision for center area
                            speed
                        } else if distance <= self.medium_quality_radius {
                            // Medium quality: Slightly reduced precision for middle area
                            speed * 0.95
                        } else {
                            // Low quality: Reduced precision for distant pixels
                            // Use coarser movement steps for better performance
                            (speed * 0.8).round()
                        };

                        // Calculate pixel coordinates (optimized with row-level y calculation)
                        let x_f32 = x as f32;
                        let dx = x_f32 - self.center_x;

                        // Normalize direction vector (reuse calculated distance)
                        let inv_distance = 1.0 / distance;
                        let norm_dx = dx * inv_distance;
                        let norm_dy = dy * inv_distance;

                        // Calculate source position
                        let source_x = x_f32 - norm_dx * effective_speed;
                        let source_y = y_f32 - norm_dy * effective_speed;

                        let source_x_int = source_x.round() as i32;
                        let source_y_int = source_y.round() as i32;

                        // Optimized bounds check
                        if source_x_int >= 0
                            && source_x_int < width_i32
                            && source_y_int >= 0
                            && source_y_int < height_i32
                        {
                            let source_index =
                                (source_y_int as usize * width) + source_x_int as usize;
                            self.temp_buffer[pixel_index] = self.persistence_buffer[source_index];
                        }
                        // Implicit else: temp_buffer[pixel_index] remains 0.0 from initialization
                    } else {
                        // Center pixel stays the same
                        self.temp_buffer[pixel_index] = self.persistence_buffer[pixel_index];
                    }
                }
            }
        } else {
            self.temp_buffer.copy_from_slice(&self.persistence_buffer);
        }
    }

    pub fn move_spiral(&mut self, options: JsValue) {
        let width = self.width as usize;
        let height = self.height as usize;

        let speed = js_sys::Reflect::get(&options, &"speed".into())
            .unwrap_or(JsValue::from(0.0))
            .as_f64()
            .unwrap_or(0.0) as f32;

        let rotation_speed = js_sys::Reflect::get(&options, &"rotation_speed".into())
            .unwrap_or(JsValue::from(0.1))
            .as_f64()
            .unwrap_or(0.1) as f32;

        self.temp_buffer.clear();
        self.temp_buffer.resize(self.persistence_buffer.len(), 0.0);

        // Spiral movement processing - Early exit for minimal movement
        if !(speed.abs() > 0.1 || rotation_speed.abs() > 0.01) {
            self.temp_buffer.copy_from_slice(&self.persistence_buffer);
            return;
        }

        // Pre-compute constants
        let width_i32 = width as i32;
        let height_i32 = height as i32;
        let speed_threshold = speed + 5.0;

        // Optimization #6: Distance-based quality processing for better performance
        // Process pixels with different accuracy based on distance from center
        for y in 0..height {
            let dest_row_base = y * width;

            for x in 0..width {
                let pixel_index = dest_row_base + x;

                // Use pre-computed polar coordinates (eliminates expensive atan2 and sqrt calls)
                let distance = self.polar_distance_lut[pixel_index];
                let angle = self.polar_angle_lut[pixel_index];

                // Early exit for center pixels using faster comparison
                if distance <= speed_threshold {
                    self.temp_buffer[pixel_index] = self.persistence_buffer[pixel_index];
                    continue;
                }

                // Optimization #6: Apply different quality levels based on distance
                let (new_distance, new_angle) = if distance <= self.high_quality_radius {
                    // High quality: Full precision for center area
                    (distance - speed, angle - rotation_speed)
                } else if distance <= self.medium_quality_radius {
                    // Medium quality: Reduced rotation precision for middle area
                    (distance - speed, angle - rotation_speed * 0.7)
                } else {
                    // Low quality: Simplified calculation for distant pixels
                    // Use approximation: skip very small rotations for distant pixels
                    if rotation_speed.abs() < 0.02 {
                        (distance - speed, angle) // Skip rotation entirely
                    } else {
                        (distance - speed, angle - rotation_speed * 0.5)
                    }
                };

                // Convert back to cartesian (still needs cos/sin, but eliminated atan2 and sqrt)
                let source_x = self.center_x + new_distance * new_angle.cos();
                let source_y = self.center_y + new_distance * new_angle.sin();

                let source_x_int = source_x.round() as i32;
                let source_y_int = source_y.round() as i32;

                // Optimized bounds check with early exit
                if source_x_int >= 0
                    && source_x_int < width_i32
                    && source_y_int >= 0
                    && source_y_int < height_i32
                {
                    let source_index = (source_y_int as usize * width) + source_x_int as usize;
                    self.temp_buffer[pixel_index] = self.persistence_buffer[source_index];
                }
                // Implicit else: temp_buffer[pixel_index] remains 0.0 from initialization
            }
        }
    }

    pub fn move_wave(&mut self, options: JsValue) {
        let width = self.width as usize;
        let height = self.height as usize;

        let amplitude = js_sys::Reflect::get(&options, &"amplitude".into())
            .unwrap_or(JsValue::from(5.0))
            .as_f64()
            .unwrap_or(5.0) as f32;

        let frequency = js_sys::Reflect::get(&options, &"frequency".into())
            .unwrap_or(JsValue::from(0.02))
            .as_f64()
            .unwrap_or(0.02) as f32;

        let phase_increment = js_sys::Reflect::get(&options, &"phase_increment".into())
            .unwrap_or(JsValue::from(0.1))
            .as_f64()
            .unwrap_or(0.1) as f32;

        // Increment the phase for animation
        self.phase += phase_increment;

        let direction = js_sys::Reflect::get(&options, &"direction".into())
            .unwrap_or(JsValue::from(0)) // 0 = horizontal, 1 = vertical
            .as_f64()
            .unwrap_or(0.0) as i32;

        self.temp_buffer.clear();
        self.temp_buffer.resize(self.persistence_buffer.len(), 0.0);

        // Early exit for minimal wave effect
        if amplitude.abs() <= 0.1 {
            self.temp_buffer.copy_from_slice(&self.persistence_buffer);
            return;
        }

        // Pre-compute constants for optimization
        let width_i32 = width as i32;
        let height_i32 = height as i32;

        // Optimization #6: Distance-based quality wave processing with cache-friendly access
        if direction == 0 {
            // Horizontal wave - cache-friendly row-by-row processing
            for y in 0..height {
                let y_f32 = y as f32;
                let distance_from_center = self.polar_distance_lut[y * width + width / 2];

                // Optimization #6: Apply different wave quality based on distance
                let effective_amplitude = if distance_from_center <= self.high_quality_radius {
                    amplitude
                } else if distance_from_center <= self.medium_quality_radius {
                    amplitude * 0.9
                } else {
                    amplitude * 0.7 // Reduced amplitude for distant rows
                };

                let wave_offset = (y_f32 * frequency + self.phase).sin() * effective_amplitude;
                let dest_row_base = y * width;

                for x in 0..width {
                    let pixel_index = dest_row_base + x;
                    let source_x = (x as f32 - wave_offset).round() as i32;
                    let source_y = y as i32;

                    if source_x >= 0 && source_x < width_i32 {
                        let source_index = (source_y as usize * width) + source_x as usize;
                        self.temp_buffer[pixel_index] = self.persistence_buffer[source_index];
                    }
                    // Implicit else: temp_buffer[pixel_index] remains 0.0 from initialization
                }
            }
        } else {
            // Vertical wave - cache-friendly column processing with row-major access
            for y in 0..height {
                let dest_row_base = y * width;

                for x in 0..width {
                    let pixel_index = dest_row_base + x;
                    let x_f32 = x as f32;
                    let distance_from_center = self.polar_distance_lut[pixel_index];

                    // Optimization #6: Apply different wave quality based on distance
                    let effective_amplitude = if distance_from_center <= self.high_quality_radius {
                        amplitude
                    } else if distance_from_center <= self.medium_quality_radius {
                        amplitude * 0.9
                    } else {
                        amplitude * 0.7 // Reduced amplitude for distant pixels
                    };

                    let wave_offset = (x_f32 * frequency + self.phase).sin() * effective_amplitude;
                    let source_x = x as i32;
                    let source_y = (y as f32 - wave_offset).round() as i32;

                    if source_y >= 0 && source_y < height_i32 {
                        let source_index = (source_y as usize * width) + source_x as usize;
                        self.temp_buffer[pixel_index] = self.persistence_buffer[source_index];
                    }
                    // Implicit else: temp_buffer[pixel_index] remains 0.0 from initialization
                }
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
