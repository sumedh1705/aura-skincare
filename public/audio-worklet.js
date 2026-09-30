/**
 * AudioWorklet Processor for capturing microphone audio.
 * 
 * This runs in a separate audio thread for low-latency PCM capture.
 * It receives Float32 audio from the microphone and converts it to
 * Int16 PCM format required by the Gemini Live API.
 * 
 * Input: Float32 audio samples (from MediaStream)
 * Output: Int16 PCM chunks posted via message port
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 2048; // Send chunks of this size
    this._buffer = new Float32Array(this._bufferSize);
    this._bytesWritten = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Mono channel

    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._bytesWritten++] = channelData[i];

      if (this._bytesWritten >= this._bufferSize) {
        // Convert Float32 to Int16 PCM
        const pcmData = this._float32ToInt16(this._buffer);
        
        // Send to main thread
        this.port.postMessage({
          type: "audio",
          data: pcmData.buffer,
        }, [pcmData.buffer]);

        // Reset buffer
        this._buffer = new Float32Array(this._bufferSize);
        this._bytesWritten = 0;
      }
    }

    return true; // Keep processor alive
  }

  _float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp and convert
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
