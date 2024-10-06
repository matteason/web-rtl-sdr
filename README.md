# Web RTL-SDR

This is an early prototype of a web-based RTL-SDR tuner.


https://github.com/user-attachments/assets/95be8221-1a66-45b5-a204-d1b5cffc96a2


It heavily relies on Sandeep Mistry's [rtlsdrjs](https://github.com/sandeepmistry/rtlsdrjs) library and Google's 
[Radio Receiver](https://github.com/google/radioreceiver) Chrome app by Jacobo Tarrío. This is just a basic Vue.js UI on top 
of those libraries with some visualisations added.

The code is mostly messy and uncommented, and about the quality you'd expect from a prototype, but there might be some
useful snippets if you're looking to do SDR on the web.

This project has only been tested with the RTL-SDR Blog V3 dongle. Other dongles with the same chipset might work too.

## License 

[GPLv3](https://www.gnu.org/licenses/gpl-3.0.en.html)

Code from [rtlsdrjs](https://github.com/sandeepmistry/rtlsdrjs) and 
[Radio Receiver](https://github.com/google/radioreceiver) is reproduced under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.

[fft.js](https://www.nayuki.io/page/free-small-fft-in-multiple-languages) is reproduced under the [MIT](https://opensource.org/license/mit) license.

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
