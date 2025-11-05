import * as LibSampleRate from "https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js/dist/libsamplerate.worklet.js";

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputSampleRate = sampleRate;
    this.outputSampleRate = 16000;

    this.inputBufferLength = 8192;
    this.buffer = new Float32Array(this.inputBufferLength);
    this.readIndex = 0;
    this.writeIndex = 0;

    this.ringBufferLength = 8192 * 4;
    this.ringBuffer = new Float32Array(this.ringBufferLength);
    this.readRingIndex = 0;
    this.writeRingIndex = 0;

    this.processCallCount = 0; // 호출 횟수 카운트

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
    for (let i = 0; i < inputChannelData.length; i++) {
      this.ringBuffer[this.writeRingIndex] = inputChannelData[i];
      this.writeRingIndex = (this.writeRingIndex + 1) % this.ringBufferLength;
    }

    this.processCallCount++;

    const threshold = parameters.threshold[0];
    // 최소 프레임 수 또는 버퍼가 꽉 찼을 때 처리
    if (
      this.getAvailableReadSamples() >= this.inputBufferLength ||
      this.processCallCount >= 50
    ) {
      const samplesToRead = Math.min(
        this.getAvailableReadSamples(),
        this.inputBufferLength
      );
      for (let i = 0; i < samplesToRead; i++) {
        this.buffer[i] = this.ringBuffer[this.readRingIndex];
        this.readRingIndex = (this.readRingIndex + 1) % this.ringBufferLength;
      }

      this.processCallCount = 0; // 카운트 초기화

      let sumSquares = 0;
      for (let i = 0; i < samplesToRead; i++) {
        sumSquares += this.buffer[i] * this.buffer[i];
      }
      const rms = Math.sqrt(sumSquares / samplesToRead);

      if (rms > threshold || samplesToRead === this.inputBufferLength) {
        const resampledData = this.convertor.simple(
          this.buffer.subarray(0, samplesToRead)
        );

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
    if (this.writeRingIndex >= this.readRingIndex) {
      return this.writeRingIndex - this.readRingIndex;
    } else {
      return this.ringBufferLength - (this.readRingIndex - this.writeRingIndex);
    }
  }
}

registerProcessor("audio-processor", AudioProcessor);
