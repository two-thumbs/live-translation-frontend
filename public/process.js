import * as LibSampleRate from "https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js/dist/libsamplerate.worklet.js";

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputSampleRate = sampleRate;
    this.outputSampleRate = 16000;

    this.inputBufferLength = 8192;
    this.buffer = new Float32Array(this.inputBufferLength);
    this.bufferFilledLength = 0; // 버퍼에 현재 차 있는 샘플 수

    this.ringBufferLength = 8192 * 4;
    this.ringBuffer = new Float32Array(this.ringBufferLength);
    this.readRingIndex = 0;
    this.writeRingIndex = 0;

    this.processCallCount = 0;

    this.isSending = false; // 현재 소리 구간 전송 중인지 상태 유지

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

    // 버퍼에 읽을 수 있는 데이터가 있다면 버퍼에 복사
    const availableSamples = this.getAvailableReadSamples();
    if (availableSamples > 0) {
      const samplesToRead = Math.min(
        availableSamples,
        this.inputBufferLength - this.bufferFilledLength
      );

      for (let i = 0; i < samplesToRead; i++) {
        this.buffer[this.bufferFilledLength + i] =
          this.ringBuffer[this.readRingIndex];
        this.readRingIndex = (this.readRingIndex + 1) % this.ringBufferLength;
      }
      this.bufferFilledLength += samplesToRead;
    }

    // bufferFilledLength가 충분하거나 processCallCount가 일정 횟수 이상인 경우 전송 체크
    if (
      this.bufferFilledLength >= this.inputBufferLength ||
      this.processCallCount >= 16
    ) {
      // RMS 계산
      let sumSquares = 0;
      for (let i = 0; i < this.bufferFilledLength; i++) {
        sumSquares += this.buffer[i] * this.buffer[i];
      }
      const rms = Math.sqrt(sumSquares / this.bufferFilledLength);

      if (rms > threshold) {
        // 소리 감지: 이때까지 모은 데이터 전부 리샘플링하고 전송
        const resampledData = this.convertor.simple(
          this.buffer.subarray(0, this.bufferFilledLength)
        );

        const outBuffer = new ArrayBuffer(resampledData.length * 2);
        const view = new DataView(outBuffer);
        for (let i = 0; i < resampledData.length; i++) {
          let s = Math.max(-1, Math.min(1, resampledData[i]));
          s = s < 0 ? s * 0x8000 : s * 0x7fff;
          view.setInt16(i * 2, s, true);
        }
        this.port.postMessage(new Uint8Array(outBuffer));

        this.isSending = true; // 소리 감지 상태 유지
        this.bufferFilledLength = 0; // 전송 후 버퍼 초기화
        this.processCallCount = 0;
      } else if (this.isSending) {
        // 소리 끊긴 직후에도 잠시 전송 유지 > 버퍼가 비워질 때까지만 전송 (예: 말 끝난 뒤 짧은 침묵 부분)
        const resampledData = this.convertor.simple(
          this.buffer.subarray(0, this.bufferFilledLength)
        );

        const outBuffer = new ArrayBuffer(resampledData.length * 2);
        const view = new DataView(outBuffer);
        for (let i = 0; i < resampledData.length; i++) {
          let s = Math.max(-1, Math.min(1, resampledData[i]));
          s = s < 0 ? s * 0x8000 : s * 0x7fff;
          view.setInt16(i * 2, s, true);
        }
        this.port.postMessage(new Uint8Array(outBuffer));

        this.bufferFilledLength = 0;
        this.processCallCount = 0;

        // 만약 앞으로도 소리 안들리면 isSending 종료 (30 processCallCount 동안 무소리이면 종료)
        if (this.processCallCount >= 30) {
          this.isSending = false;
          this.processCallCount = 0;
        }
      } else {
        // 완전 무소리 상태이므로 버퍼 초기화 및 전송 안함
        this.bufferFilledLength = 0;
        this.processCallCount = 0;
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
