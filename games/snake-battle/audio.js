// Extracted without changing the original functions; page state stays in game.js.
function initAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return false;
    }

    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return true;
}

function makeTone(
  frequency,
  duration,
  volume = 0.05,
  type = "sine",
  startDelay = 0,
) {
  if (!initAudio()) {
    return;
  }

  const now = audioContext.currentTime + startDelay;

  const oscillator = audioContext.createOscillator();

  const gain = audioContext.createGain();

  oscillator.type = type;

  oscillator.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);

  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);

  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);

  gain.connect(audioContext.destination);

  oscillator.start(now);

  oscillator.stop(now + duration + 0.03);
}

function playPointSound(playerNumber) {
  if (!playerNumber) {
    return;
  }

  const index = playerNumber - 1;

  const now = performance.now();

  if (now - lastPointSoundTimes[index] < 32) {
    return;
  }

  lastPointSoundTimes[index] = now;

  makeTone(820 + Math.random() * 90, 0.055, 0.035, "square");

  makeTone(1180 + Math.random() * 100, 0.035, 0.018, "sine", 0.018);
}

function playKillSound() {
  if (!initAudio()) {
    return;
  }

  makeTone(180, 0.16, 0.1, "sawtooth");

  makeTone(105, 0.22, 0.08, "square", 0.03);

  makeTone(75, 0.27, 0.07, "sawtooth", 0.055);

  const length = Math.floor(audioContext.sampleRate * 0.16);

  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);

  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const source = audioContext.createBufferSource();

  const gain = audioContext.createGain();

  const filter = audioContext.createBiquadFilter();

  filter.type = "bandpass";

  filter.frequency.value = 1500;

  filter.Q.value = 0.7;

  gain.gain.value = 0.075;

  source.buffer = buffer;

  source.connect(filter);

  filter.connect(gain);

  gain.connect(audioContext.destination);

  source.start();
}

function playDeathSound() {
  if (!initAudio()) {
    return;
  }

  makeTone(95, 0.3, 0.12, "sawtooth");

  makeTone(65, 0.42, 0.1, "square", 0.025);

  makeTone(42, 0.48, 0.08, "sine", 0.06);
}

function playBoostSound() {
  if (!initAudio()) {
    return;
  }

  makeTone(160, 0.1, 0.035, "sawtooth");

  makeTone(240, 0.13, 0.03, "triangle", 0.03);

  makeTone(340, 0.17, 0.025, "sine", 0.07);
}

function playFirstPlaceSound() {
  makeTone(523.25, 0.11, 0.06, "square");

  makeTone(659.25, 0.11, 0.06, "square", 0.12);

  makeTone(783.99, 0.12, 0.07, "square", 0.24);

  makeTone(1046.5, 0.27, 0.08, "sine", 0.36);
}

function bgmNote() {
  if (!playing) {
    return;
  }

  const melody = [
    261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 349.23, 261.63,
    329.63, 392.0, 523.25, 440.0, 392.0, 329.63, 293.66,
  ];

  const bass = [130.81, 130.81, 146.83, 146.83, 110.0, 110.0, 130.81, 130.81];

  const note = melody[bgmStep % melody.length];

  const bassNote = bass[Math.floor(bgmStep / 2) % bass.length];

  makeTone(note, 0.17, 0.018, "triangle");

  if (bgmStep % 2 === 0) {
    makeTone(bassNote, 0.28, 0.018, "sine");
  }

  bgmStep++;
}

function startBGM() {
  stopBGM();

  if (!initAudio()) {
    return;
  }

  bgmStep = 0;

  bgmNote();

  bgmTimer = setInterval(bgmNote, 220);
}

function stopBGM() {
  if (bgmTimer) {
    clearInterval(bgmTimer);

    bgmTimer = null;
  }
}
