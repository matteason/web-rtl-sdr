import { AudioPlayer } from "@/AudioPlayer";

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
      console.log("Freq unchanged");
      const scanObj = this.isScanning
        ? {
            scanning: true,
            frequency: this.centerFrequency,
          }
        : null;
      const samples = await this.sdr.readSamples(this.samplesPerBuf);
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
    player.play(left, right, level, 0);
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
}
