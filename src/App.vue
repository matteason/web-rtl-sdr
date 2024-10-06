<template>
  <button @click="initSdr">Connect to receiver</button>
  <button @click="pause">Pause</button>
  <button @click="resume">Resume</button>
  <button @click="scanBack">Scan back</button>
  <button @click="scanForward">Scan fwd</button>
  <input
    type="range"
    min="87.5"
    max="108"
    step="0.01"
    v-model.number="frequencyMhz"
  />
  <input
    type="number"
    min="87.5"
    max="108"
    step="0.01"
    v-model.number="frequencyMhz"
  />
  <br />
  <button
    @click="
      () => {
        setFrequency(98.8);
      }
    "
  >
    Radio 1
  </button>
  <button
    @click="
      () => {
        setFrequency(89.09);
      }
    "
  >
    Radio 2
  </button>
  <button
    @click="
      () => {
        setFrequency(93.5);
      }
    "
  >
    Radio 4
  </button>
  <canvas id="wfcanvas" width="1024" height="255" style="display: block" />
  <canvas id="canvas2" width="1024" height="255" style="display: block" />
  <canvas id="canvas3" width="1024" height="1024" style="display: block" />
</template>

<script>
import { Tuner } from "@/Tuner";

export default {
  data() {
    return {
      tuner: null,
      frequencyMhz: 98.8,
    };
  },

  computed: {
    frequencyHz() {
      return this.frequencyMhz * 1000000;
    },
  },

  watch: {
    frequencyHz() {
      if (this.tuner) {
        this.tuner.setFrequency(this.frequencyHz);
      }
    },
  },

  methods: {
    async initSdr() {
      this.tuner = new Tuner(1024000, this.frequencyHz);
      await this.tuner.init();
    },

    pause() {
      this.tuner.pause();
    },

    resume() {
      this.tuner.resume();
    },

    scanBack() {
      this.scan(87.5 * 1000000, this.frequencyMhz * 1000000, -0.01 * 1000000);
    },

    scanForward() {
      this.scan(this.frequencyMhz * 1000000, 108 * 1000000, 0.01 * 1000000);
    },

    scan(min, max, step) {
      this.tuner.scan(min, max, step, 0.7, (newFrequency) => {
        this.setFrequency(newFrequency / 1000000);
      });
    },

    setFrequency(frequency) {
      this.frequencyMhz = frequency;
    },
  },
};
</script>

<style scoped lang="scss"></style>
