let audioContext;
let backgroundMusic;
let backgroundMusicUrl;
const soundFiles = new Map();

export function readSoundPreference() {
  return window.localStorage.getItem('petgame-sound') !== 'off';
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function tone(context, frequency, start, duration, type = 'sine', peak = 0.045) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function impact(context, start, peak = 0.2) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(105, start);
  oscillator.frequency.exponentialRampToValueAtTime(48, start + 0.19);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.26);
}

export function playSoundCue(cue, enabled) {
  if (!enabled) return;
  const soundUrl = window.petgameConfig?.assets?.sounds?.[cue];
  if (typeof soundUrl === 'string' && soundUrl.trim()) {
    let template = soundFiles.get(cue);
    const resolvedUrl = new URL(soundUrl, window.location.href).href;
    if (!template || template.src !== resolvedUrl) {
      template = new Audio(resolvedUrl);
      soundFiles.set(cue, template);
    }
    const sound = template.cloneNode();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      console.warn(`[petgame] Could not play the "${cue}" sound asset.`, error);
    });
    return;
  }

  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;

  if (cue === 'card-start') {
    impact(context, now, 0.22);
    tone(context, 280, now, 0.09, 'triangle', 0.025);
    tone(context, 390, now + 0.09, 0.1, 'triangle', 0.035);
    tone(context, 540, now + 0.2, 0.16, 'triangle', 0.045);
  } else if (cue === 'card-reveal') {
    impact(context, now, 0.26);
    tone(context, 523.25, now, 0.22, 'sine', 0.055);
    tone(context, 659.25, now + 0.075, 0.26, 'sine', 0.05);
    tone(context, 783.99, now + 0.15, 0.32, 'sine', 0.045);
  } else if (cue === 'care') {
    impact(context, now, 0.14);
    tone(context, 440, now, 0.1, 'triangle', 0.035);
    tone(context, 587.33, now + 0.075, 0.14, 'triangle', 0.04);
  } else if (cue === 'select') {
    tone(context, 480, now, 0.07, 'sine', 0.03);
  } else if (cue === 'toggle') {
    tone(context, 660, now, 0.07, 'sine', 0.03);
    tone(context, 880, now + 0.055, 0.11, 'sine', 0.035);
  } else if (cue === 'save') {
    tone(context, 523.25, now, 0.1, 'sine', 0.04);
    tone(context, 698.46, now + 0.08, 0.18, 'sine', 0.04);
  } else if (cue === 'rank-pop') {
    impact(context, now, 0.17);
    tone(context, 680, now, 0.065, 'triangle', 0.05);
    tone(context, 960, now + 0.025, 0.11, 'sine', 0.035);
  } else if (cue === 'checkin-complete') {
    impact(context, now, 0.18);
    tone(context, 523.25, now + 0.035, 0.13, 'triangle', 0.05);
    tone(context, 783.99, now + 0.11, 0.2, 'sine', 0.045);
  } else if (cue === 'intro') {
    impact(context, now, 0.2);
    tone(context, 392, now + 0.025, 0.12, 'triangle', 0.04);
    tone(context, 523.25, now + 0.12, 0.13, 'triangle', 0.05);
    tone(context, 783.99, now + 0.22, 0.23, 'sine', 0.045);
  } else if (cue === 'confirm') {
    impact(context, now, 0.12);
    tone(context, 587.33, now + 0.025, 0.1, 'triangle', 0.04);
  } else if (cue === 'navigation' || cue === 'drawer' || cue === 'tab' || cue === 'points-focus') {
    tone(context, cue === 'navigation' ? 460 : 520, now, 0.06, 'sine', 0.025);
  }
}

export function setBackgroundMusicEnabled(enabled) {
  const musicUrl = window.petgameConfig?.assets?.backgroundMusic;
  if (!musicUrl) {
    backgroundMusic?.pause();
    return;
  }

  if (!backgroundMusic || backgroundMusicUrl !== musicUrl) {
    backgroundMusic?.pause();
    backgroundMusic = new Audio(musicUrl);
    backgroundMusicUrl = musicUrl;
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.22;
  }

  if (enabled) {
    backgroundMusic.play().catch((error) => {
      console.warn('[petgame] Could not play the background music asset.', error);
    });
  } else {
    backgroundMusic.pause();
  }
}
