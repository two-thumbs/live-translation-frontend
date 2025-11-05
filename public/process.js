import * as LibSampleRate from "https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js/dist/libsamplerate.worklet.js";

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputSampleRate = sampleRate;
    this.outputSampleRate = 16000;

    this.bufferSize = Math.floor(
      (8192 * this.inputSampleRate) / this.outputSampleRate
    );
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferOffset = 0;

    LibSampleRate.create(1, this.inputSampleRate, this.outputSampleRate, {
      converterType: LibSampleRate.ConverterType.SRC_SINC_BEST_QUALITY,
    }).then((src) => (this.convertor = src));
  }

  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: 0.001, minValue: 0, maxValue: 0.05 },
    ];
  }

  process(inputs, outputs, parameters) {
    if (!this.convertor) return true;
    const input = inputs[0];
    if (!input.length) return true;

    const inputChannelData = input[0];
    let inputIndex = 0;

    while (inputIndex < inputChannelData.length) {
      const spaceLeft = this.bufferSize - this.bufferOffset;
      const copyLength = Math.min(
        spaceLeft,
        inputChannelData.length - inputIndex
      );
      this.buffer.set(
        inputChannelData.subarray(inputIndex, inputIndex + copyLength),
        this.bufferOffset
      );
      this.bufferOffset += copyLength;
      inputIndex += copyLength;

      if (this.bufferOffset === this.bufferSize) {
        let sumSquares = 0;
        for (let i = 0; i < this.bufferSize; i++) {
          sumSquares += this.buffer[i] * this.buffer[i];
        }
        const rms = Math.sqrt(sumSquares / this.bufferSize);

        // const threshold = 0.01;
        const threshold = parameters.threshold[0];
        if (rms > threshold) {
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

        this.bufferOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
