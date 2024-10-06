import { AudioPlayer } from "@/AudioPlayer";
import { transform } from "@/lib/fft.js";

export class Tuner {
  sdr: any;
  sampleRate: number;
  bufsPerSec = 30;
  samplesPerBuf: number;
  centerFrequency: number;
  actualFrequency: number | null;
  newFrequency: number | null = null;
  enabled = true;
  decoder: Worker;
  stereoEnabled = true;
  player: AudioPlayer;
  isScanning = false;
  scanMinFreq: number | null;
  scanMaxFreq: number | null;
  scanStep: number | null;
  scanLevelThreshold: number | null;
  scanStarted = false;
  scanCompleteCallback: Function | null;
  lastIq: any;

  constructor(sampleRate: number, centerFrequency: number) {
    this.sampleRate = sampleRate;
    this.centerFrequency = centerFrequency;
    this.samplesPerBuf = Math.floor(this.sampleRate / this.bufsPerSec);
    this.decoder = new Worker("decoder/decode-worker.js");
    this.player = new AudioPlayer();
    //Set decoder mode
    this.decoder.postMessage([1, "WBFM"]);
  }

  async init() {
    this.sdr = await window.RtlSdr.requestDevice();

    await this.sdr.open({
      ppm: 0.5,
    });

    await this.sdr.setSampleRate(this.sampleRate);

    this.actualFrequency = await this.sdr.setCenterFrequency(
      this.centerFrequency
    );

    await this.sdr.resetBuffer();
    this.decoder.addEventListener("message", (msg) => {
      this.receiveDemodulated(msg, this.player);
    });

    this.readLoop();
    this.updateCanvas();
  }

  async readLoop() {
    if (!this.enabled) {
      return;
    }

    if (
      this.newFrequency !== null &&
      this.newFrequency != this.centerFrequency
    ) {
      console.log(`Frequency changed, updating to ${this.newFrequency}`);
      this.sdr.resetBuffer().then(() => {
        this.centerFrequency = this.newFrequency;
        this.sdr
          .setCenterFrequency(this.centerFrequency)
          .then((actualFrequency: number) => {
            console.log(`Frequency changed to ${actualFrequency}`);
            this.actualFrequency = actualFrequency;
            console.log(
              `isScanning ${this.isScanning}, scanStarted ${this.scanStarted}`
            );
            if (this.isScanning && !this.scanStarted) {
              this.scanStarted = true;
            }
            this.readLoop();
          });
      });
    } else {
      const scanObj = this.isScanning
        ? {
            scanning: true,
            frequency: this.centerFrequency,
          }
        : null;
      const samples = await this.sdr.readSamples(this.samplesPerBuf);

      this.lastIq = this.iqSamplesFromUint8(new Uint8Array(samples));

      this.decoder.postMessage(
        [
          0,
          samples,
          this.stereoEnabled,
          this.actualFrequency! - this.centerFrequency,
          scanObj,
        ],
        [samples]
      );

      if (
        this.isScanning &&
        this.scanMinFreq &&
        this.scanMaxFreq &&
        this.scanStep
      ) {
        if (this.scanStarted) {
          this.newFrequency = this.centerFrequency + this.scanStep;

          if (
            this.newFrequency > this.scanMaxFreq ||
            this.newFrequency < this.scanMinFreq
          ) {
            this.newFrequency =
              this.newFrequency > this.scanMaxFreq
                ? this.scanMaxFreq
                : this.scanMinFreq;

            this.isScanning = false;
            this.scanStarted = false;

            if (this.scanCompleteCallback) {
              this.scanCompleteCallback(this.newFrequency);
            }
          }
        }
        console.log(this.scanStarted);
        console.log(`Scanning, new freq ${this.newFrequency}`);
      }

      this.readLoop();
    }
  }

  async setFrequency(frequency: number) {
    this.newFrequency = frequency;
  }

  pause() {
    this.enabled = false;
  }

  resume() {
    this.enabled = true;
    this.readLoop();
  }

  scan(
    minFreq: number,
    maxFreq: number,
    step: number,
    levelThreshold: number,
    callback: Function | null
  ) {
    this.scanMinFreq = minFreq;
    this.scanMaxFreq = maxFreq;
    this.scanStep = step;
    this.scanLevelThreshold = levelThreshold;
    if (step < 0) {
      this.newFrequency =
        this.scanMaxFreq === this.centerFrequency
          ? this.scanMaxFreq + this.scanStep
          : this.scanMaxFreq;
    } else {
      this.newFrequency =
        this.scanMinFreq === this.centerFrequency
          ? this.scanMinFreq + this.scanStep
          : this.scanMinFreq;
    }
    this.isScanning = true;
    this.scanStarted = false;
    this.scanCompleteCallback = callback;
  }

  receiveDemodulated(msg: any, player: AudioPlayer) {
    const level = msg.data[2]["signalLevel"];
    const left = new Float32Array(msg.data[0]);
    const right = new Float32Array(msg.data[1]);
    const IQ = new Float32Array(msg.data[3]);
    player.play(left, right, level, 0, IQ);
    if (msg.data[2].scanning && level >= this.scanLevelThreshold) {
      console.log("Scanning stopped");
      console.log(msg.data[2]);
      this.isScanning = false;
      this.scanStarted = false;
      this.newFrequency = msg.data[2].frequency;

      if (this.scanCompleteCallback) {
        this.scanCompleteCallback(this.newFrequency);
      }
      console.log(`Scan locked on ${this.newFrequency}`);
    }
  }

  updateCanvas() {
    if (this.lastIq) {
      const iq = this.lastIq;
      const x = 4096 * 8;
      const a = iq[0].slice(0, x);
      const b = iq[1].slice(0, x);
      transform(a, b);
      const spectrogram = [
        ...a.slice(Math.floor(a.length / 2), a.length),
        ...a.slice(0, Math.floor(a.length / 2)),
      ];
      //console.log(iq);
      //setTimeout(() => this.drawCanvas(), 5000);
      const height = 255;
      const width = 1024;
      // @ts-ignore
      const ctx = document.getElementById("canvas2").getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#000000";
      ctx.beginPath();

      const c3 = document.getElementById("canvas3");
      const ctx2 = c3.getContext("2d");
      ctx2.drawImage(
        c3,
        0,
        0,
        c3.width,
        c3.height - 1,
        0,
        1,
        c3.width,
        c3.height - 1
      );
      const imgData = ctx2.createImageData(width, 1);

      const step = Math.floor(spectrogram.length / width);
      for (let i = 0; i < spectrogram.length; i += step) {
        const y =
          height -
          Math.floor(Math.abs(spectrogram[i] / 512) * height) / 4 -
          100;
        if (i === 0) {
          ctx.moveTo(0, y);
        } else {
          ctx.lineTo((i / spectrogram.length) * width, y);
        }

        const colorVal = Math.floor(Math.abs(spectrogram[i]));
        imgData.data[4 * (i / step)] = colorVal; // Red
        imgData.data[4 * (i / step) + 1] = 0; // Green
        imgData.data[4 * (i / step) + 2] = colorVal; // Blue
        imgData.data[4 * (i / step) + 3] = 255; // Alpha
      }

      ctx.stroke();
      ctx2.putImageData(imgData, 0, 0);
    }

    requestAnimationFrame(() => {
      this.updateCanvas.call(this);
    });
  }

  iqSamplesFromUint8(buffer) {
    const arr = new Uint8Array(buffer);
    const len = arr.length / 2;
    const outI = new Float32Array(len);
    const outQ = new Float32Array(len);
    for (let i = 0; i < len; ++i) {
      outI[i] = arr[2 * i] / 128 - 0.995;
      outQ[i] = arr[2 * i + 1] / 128 - 0.995;
    }
    return [outI, outQ];
  }
}
