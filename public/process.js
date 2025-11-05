import * as LibSampleRate from "https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js/dist/libsamplerate.worklet.js";

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputSampleRate = sampleRate;
    this.outputSampleRate = 16000;

    this.inputBufferLength = 8192;
    this.buffer = new Float32Array(this.inputBufferLength);
    this.writeIndex = 0;

    this.ringBufferLength = 8192 * 4; // 충분히 큰 링버퍼
    this.ringBuffer = new Float32Array(this.ringBufferLength);
    this.readIndex = 0;
    this.writeRingIndex = 0;

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

    // 입력 데이터를 링버퍼에 씀
    for (let i = 0; i < inputChannelData.length; i++) {
      this.ringBuffer[this.writeRingIndex] = inputChannelData[i];
      this.writeRingIndex = (this.writeRingIndex + 1) % this.ringBufferLength;
    }

    // 버퍼 완성 확인 후 처리
    while (this.getAvailableReadSamples() >= this.inputBufferLength) {
      // 링버퍼에서 버퍼크기만큼 데이터 꺼냄
      for (let i = 0; i < this.inputBufferLength; i++) {
        this.buffer[i] = this.ringBuffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.ringBufferLength;
      }

      let sumSquares = 0;
      for (let i = 0; i < this.inputBufferLength; i++) {
        sumSquares += this.buffer[i] * this.buffer[i];
      }
      const rms = Math.sqrt(sumSquares / this.inputBufferLength);

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
    }

    return true;
  }

  getAvailableReadSamples() {
    if (this.writeRingIndex >= this.readIndex) {
      return this.writeRingIndex - this.readIndex;
    } else {
      return this.ringBufferLength - (this.readIndex - this.writeRingIndex);
    }
  }
}

registerProcessor("audio-processor", AudioProcessor);
