/**
 * Web Audio API volume matching engine for auto-adjusting lesson audio
 * to match user's guitar playing volume.
 *
 * Uses a shared AudioContext singleton (same pattern as clickGenerator.ts and audioGenerator.ts).
 * Analyzes microphone input and playback audio in real-time, then adjusts playback volume
 * with smoothing to create a balanced mix.
 */

// ---------------------------------------------------------------------------
// AudioContext singleton
// ---------------------------------------------------------------------------

let audioContext: AudioContext | null = null;

/**
 * Get or create a shared AudioContext.
 * Automatically resumes a suspended context (required after user gesture).
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface VolumeMatcherOptions {
  /** Smoothing factor for volume adjustments (0-1). Higher = smoother but slower response. Default: 0.3 */
  smoothingFactor?: number;
  /** Update interval in milliseconds. Default: 200 */
  updateInterval?: number;
  /** Minimum volume percentage (prevents silence). Default: 10 */
  minVolume?: number;
  /** Maximum volume percentage (prevents distortion). Default: 100 */
  maxVolume?: number;
  /** Target ratio (playback RMS / mic RMS). 1.0 = playback matches mic level. Default: 1.0 */
  targetRatio?: number;
  /** Threshold for mic RMS below which no adjustments occur (prevents noise triggering). Default: 0.05 */
  micThreshold?: number;
  /** Minimum volume change percentage to trigger callback (reduces unnecessary updates). Default: 2 */
  minChangePercent?: number;
  /** Mic smoothing factor (0-1). Higher = smoother but slower response. Default: 0.85 */
  micSmoothingFactor?: number;
}

const DEFAULT_OPTIONS: Required<VolumeMatcherOptions> = {
  smoothingFactor: 0.3,
  updateInterval: 200,
  minVolume: 10,
  maxVolume: 100,
  targetRatio: 1.0,
  micThreshold: 0.05,
  minChangePercent: 2,
  micSmoothingFactor: 0.85,
};

// ---------------------------------------------------------------------------
// VolumeMatcher Class
// ---------------------------------------------------------------------------

export type VolumeAdjustCallback = (newVolume: number) => void;

export class VolumeMatcher {
  private options: Required<VolumeMatcherOptions>;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private playbackSource: MediaElementAudioSourceNode | null = null;
  private isActive = false;
  private updateIntervalId: number | null = null;
  private currentMicLevel = 0;
  private currentPlaybackLevel = 0;
  private smoothedMicLevel = 0;
  private lastAdjustedVolume = 50; // Track last volume for change detection
  private onVolumeAdjust: VolumeAdjustCallback | null = null;
  private isPlaybackConnected = false;

  constructor(options: VolumeMatcherOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Set the callback function that receives volume adjustment updates.
   */
  setVolumeAdjustCallback(callback: VolumeAdjustCallback): void {
    this.onVolumeAdjust = callback;
  }

  /**
   * Request microphone access with guitar-optimized settings.
   * Returns true if granted, false if denied.
   */
  async requestMicrophoneAccess(): Promise<boolean> {
    try {
      const ctx = getAudioContext();

      // Request microphone with guitar-optimized settings
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Keep raw guitar sound
          noiseSuppression: false, // Don't filter guitar frequencies
          autoGainControl: false, // Manual volume control
        },
      });

      // Create analyser for microphone input
      const micSource = ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 2048;
      this.micAnalyser.smoothingTimeConstant = 0.8;

      micSource.connect(this.micAnalyser);

      return true;
    } catch (error) {
      console.error("Failed to access microphone:", error);
      return false;
    }
  }

  /**
   * Connect the playback audio element to the Web Audio API for analysis.
   * CRITICAL: Must route to destination or audio won't play.
   */
  connectPlaybackSource(audioElement: HTMLAudioElement): void {
    if (this.isPlaybackConnected) {
      console.warn("VolumeMatcher: Playback source already connected");
      return;
    }

    try {
      console.log("VolumeMatcher: Connecting playback source...");
      const ctx = getAudioContext();
      console.log("VolumeMatcher: AudioContext state:", ctx.state);
      console.log("VolumeMatcher: Audio element paused:", audioElement.paused, "src:", audioElement.src.substring(0, 100));

      // Create analyser for playback audio
      this.playbackAnalyser = ctx.createAnalyser();
      this.playbackAnalyser.fftSize = 2048;
      this.playbackAnalyser.smoothingTimeConstant = 0.8;

      // Connect audio element to analyser and destination
      // CRITICAL: MediaElementSource can only be created once per element
      this.playbackSource = ctx.createMediaElementSource(audioElement);
      this.playbackSource.connect(this.playbackAnalyser);
      this.playbackAnalyser.connect(ctx.destination);

      this.isPlaybackConnected = true;
      console.log("VolumeMatcher: Playback source connected successfully");
    } catch (error) {
      // If createMediaElementSource fails (already created), try to reuse existing connection
      console.error("VolumeMatcher: Failed to connect playback source:", error);
    }
  }

  /**
   * Start the volume matching update loop.
   */
  start(): void {
    if (this.isActive) {
      console.warn("VolumeMatcher already active");
      return;
    }

    if (!this.micAnalyser) {
      console.error("Cannot start: mic analyser not initialized");
      return;
    }

    this.isActive = true;
    this.updateIntervalId = window.setInterval(() => {
      this.updateVolumes();
    }, this.options.updateInterval);

    console.log("VolumeMatcher started (mic-only mode)");
  }

  /**
   * Stop the volume matching update loop (but keep connections alive).
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }

    console.log("VolumeMatcher stopped");
  }

  /**
   * Clean up all resources: stop updates, release microphone, disconnect audio nodes.
   */
  cleanup(): void {
    this.stop();

    // Release microphone
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    // Disconnect audio nodes
    if (this.micAnalyser) {
      this.micAnalyser.disconnect();
      this.micAnalyser = null;
    }

    // Note: We don't disconnect playback source/analyser here because
    // MediaElementSource can only be created once. The audio element
    // will continue to route through Web Audio API.

    this.isPlaybackConnected = false;
    console.log("VolumeMatcher cleaned up");
  }

  /**
   * Calculate Root Mean Square (RMS) from time domain data.
   * RMS represents the average energy/volume of the signal.
   */
  private calculateRMS(dataArray: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      // Convert from 0-255 to -1 to 1 range
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  /**
   * Main update loop: measure RMS levels and adjust volume if needed.
   * Mic-only mode: only analyzes microphone input.
   */
  private updateVolumes(): void {
    if (!this.micAnalyser) {
      console.warn("VolumeMatcher: Mic analyser not initialized");
      return;
    }

    // Get time domain data from mic analyser
    const micData = new Uint8Array(this.micAnalyser.fftSize);
    this.micAnalyser.getByteTimeDomainData(micData);

    // Calculate mic RMS level
    this.currentMicLevel = this.calculateRMS(micData);

    // Apply heavy smoothing to mic level to reduce jitter from pick attacks
    const { micSmoothingFactor } = this.options;
    this.smoothedMicLevel =
      this.smoothedMicLevel * micSmoothingFactor +
      this.currentMicLevel * (1 - micSmoothingFactor);

    // Debug logging every 2 seconds (10 updates at 200ms interval)
    if (Math.random() < 0.05) {
      console.log(`VolumeMatcher levels - Mic: ${this.smoothedMicLevel.toFixed(3)}, Threshold: ${this.options.micThreshold}`);
    }

    // Adjust volume based on playing or apply decay when stopped
    if (this.smoothedMicLevel > this.options.micThreshold) {
      // User is playing - adjust volume based on mic level
      this.adjustPlaybackVolume();
    } else {
      // User stopped playing - gradually decay volume back to baseline (40%)
      this.decayVolume();
    }
  }

  /**
   * Calculate and apply volume adjustment with smoothing and bounds.
   * Uses mic-only algorithm: maps mic RMS directly to volume level.
   */
  private adjustPlaybackVolume(): void {
    if (!this.onVolumeAdjust) {
      console.warn("VolumeMatcher: No volume adjust callback set");
      return;
    }

    // Mic-only algorithm: map mic RMS to volume (10%-80%)
    // Scale factor: higher mic level = higher volume
    // Reduced from 3500 to prevent too-loud volumes
    const micScaleFactor = 2200; // Moderate sensitivity for audio interface input
    const targetVolume = Math.min(80, 10 + (this.smoothedMicLevel * micScaleFactor));

    // Apply exponential smoothing to prevent jarring jumps
    const { smoothingFactor } = this.options;
    const smoothedVolume =
      this.lastAdjustedVolume * smoothingFactor +
      targetVolume * (1 - smoothingFactor);

    // Clamp to min/max bounds
    const clampedVolume = Math.max(
      this.options.minVolume,
      Math.min(this.options.maxVolume, smoothedVolume)
    );

    // Only trigger callback if change is significant (reduces unnecessary updates)
    const changePercent = Math.abs(clampedVolume - this.lastAdjustedVolume);
    if (changePercent >= this.options.minChangePercent) {
      console.log(`VolumeMatcher: Adjusting volume from ${this.lastAdjustedVolume.toFixed(1)}% to ${clampedVolume.toFixed(1)}% (mic: ${this.smoothedMicLevel.toFixed(3)})`);
      this.lastAdjustedVolume = clampedVolume;
      this.onVolumeAdjust(Math.round(clampedVolume));
    }
  }

  /**
   * Gradually decay volume back to baseline when user stops playing.
   * This prevents volume from staying too loud after playing low notes.
   */
  private decayVolume(): void {
    if (!this.onVolumeAdjust) {
      return;
    }

    const baselineVolume = 40; // Target volume to decay toward
    const decayRate = 0.95; // Slow decay (0.95 = keep 95% of current, move 5% toward baseline)

    // Only decay if current volume is above baseline
    if (this.lastAdjustedVolume > baselineVolume) {
      const targetVolume = this.lastAdjustedVolume * decayRate + baselineVolume * (1 - decayRate);

      // Only update if change is significant
      const changePercent = Math.abs(targetVolume - this.lastAdjustedVolume);
      if (changePercent >= this.options.minChangePercent) {
        console.log(`VolumeMatcher: Decaying volume from ${this.lastAdjustedVolume.toFixed(1)}% to ${targetVolume.toFixed(1)}%`);
        this.lastAdjustedVolume = targetVolume;
        this.onVolumeAdjust(Math.round(targetVolume));
      }
    }
  }

  /**
   * Get current mic and playback RMS levels for debugging.
   */
  getLevels(): { mic: number; playback: number; smoothedMic: number } {
    return {
      mic: this.currentMicLevel,
      playback: this.currentPlaybackLevel,
      smoothedMic: this.smoothedMicLevel,
    };
  }

  /**
   * Check if volume matcher is currently active.
   */
  isRunning(): boolean {
    return this.isActive;
  }
}
