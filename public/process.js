import * as LibSampleRate from "https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js/dist/libsamplerate.worklet.js";

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputSampleRate = sampleRate;
    this.outputSampleRate = 16000;
    this.bufferSize = 8192;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;

    LibSampleRate.create(1, this.inputSampleRate, this.outputSampleRate, {
      converterType: LibSampleRate.ConverterType.SRC_SINC_BEST_QUALITY,
    }).then((src) => (this.convertor = src));
  }

  process(inputs) {
    if (!this.convertor) return true;

    const input = inputs[0];
    if (!input.length) return true;

    const inputChannelData = input[0];

    for (let i = 0; i < inputChannelData.length; i++) {
      this.buffer[this.writeIndex++] = inputChannelData[i];

      if (this.writeIndex >= this.bufferSize) {
        this.processBuffer();
        this.writeIndex = 0;
      }
    }

    return true;
  }

  processBuffer() {
    const resampledData = this.convertor.simple(this.buffer);

    const outBuffer = new ArrayBuffer(resampledData.length * 2);
    const view = new DataView(outBuffer);

    for (let i = 0; i < resampledData.length; i++) {
      let s = Math.max(-1, Math.min(1, resampledData[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, s, true);
    }

    this.port.postMessage(new Uint8Array(outBuffer));
  }
}

registerProcessor("audio-processor", AudioProcessor);
