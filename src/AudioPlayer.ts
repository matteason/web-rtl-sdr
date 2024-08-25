export class AudioPlayer {
  audioContext: AudioContext;
  gainNode: GainNode;
  outRate = 48000;
  timeBuffer = 0.05;
  squelchTail = 0.3;
  lastPlayedAt = -1;
  squelchTime: number | null = -2;
  leftSamples: Float32Array | null | undefined;

  constructor() {
    this.audioContext = new AudioContext();
    this.gainNode = new GainNode(this.audioContext);
    requestAnimationFrame(() => {
      this.drawCanvas.call(this);
    });
  }

  play(
    leftSamples: Float32Array,
    rightSamples: Float32Array,
    level: number,
    squelch: number
  ) {
    const buffer = this.audioContext.createBuffer(
      2,
      leftSamples.length,
      this.outRate
    );
    if (level >= squelch) {
      this.squelchTime = null;
    } else if (this.squelchTime === null) {
      this.squelchTime = this.lastPlayedAt;
    }
    if (
      this.squelchTime === null ||
      this.lastPlayedAt - this.squelchTime < this.squelchTail
    ) {
      buffer.getChannelData(0).set(leftSamples);
      buffer.getChannelData(1).set(rightSamples);
    }

    this.leftSamples = leftSamples;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode).connect(this.audioContext.destination);
    this.lastPlayedAt = Math.max(
      this.lastPlayedAt + leftSamples.length / this.outRate,
      this.audioContext.currentTime + this.timeBuffer
    );
    source.start(this.lastPlayedAt);
  }

  drawCanvas() {
    const height = 100;
    if (this.leftSamples !== undefined && this.leftSamples) {
      // @ts-ignore
      const ctx = document.getElementById("wfcanvas").getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, this.leftSamples.length, 100);
      ctx.strokeStyle = "#000000";
      ctx.beginPath();
      const y = Math.floor(((this.leftSamples[0] + 1) / 2.0) * height);
      ctx.moveTo(0, y);
      for (let i = 1; i < this.leftSamples.length; i++) {
        const y = Math.floor(((this.leftSamples[i] + 1) / 2.0) * height);
        ctx.lineTo(i, y);
      }
      ctx.stroke();
    }

    requestAnimationFrame(() => {
      this.drawCanvas.call(this);
    });
  }
}
