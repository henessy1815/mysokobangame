/**
 * 효과음.
 *
 * 오디오 파일을 따로 받지 않고 WebAudio로 그때그때 짧은 음을 합성한다.
 * 지하철처럼 네트워크가 끊기는 환경에서도 첫 화면이 빨리 떠야 하므로
 * 받아야 할 에셋을 늘리지 않는 편이 낫다.
 *
 * AudioContext는 사용자의 첫 입력이 있기 전에는 만들지 않는다.
 * 브라우저 자동재생 정책 때문에 미리 만들어 봐야 suspended 상태로 남는다.
 */

let context = null

function getContext() {
  if (typeof window === 'undefined') return null
  if (context) return context
  const Ctor = window.AudioContext ?? window.webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    return null
  }
  return context
}

function tone({ frequency, duration, type = 'sine', volume = 0.12, sweepTo = null }) {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  if (sweepTo) oscillator.frequency.exponentialRampToValueAtTime(sweepTo, now + duration)

  // 딸깍거리는 클릭 노이즈를 막기 위해 아주 짧은 어택과 지수 감쇠를 준다.
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.02)
}

export const SFX = {
  step: () => tone({ frequency: 180, duration: 0.05, type: 'triangle', volume: 0.05 }),
  push: () => tone({ frequency: 110, duration: 0.11, type: 'sawtooth', volume: 0.07, sweepTo: 78 }),
  goal: () => tone({ frequency: 880, duration: 0.18, type: 'sine', volume: 0.1, sweepTo: 1320 }),
  blocked: () => tone({ frequency: 70, duration: 0.09, type: 'square', volume: 0.05 }),
  undo: () => tone({ frequency: 320, duration: 0.08, type: 'sine', volume: 0.06, sweepTo: 220 }),
  // 사과를 주울 때의 짧은 상승음. 목표 달성음(goal)보다 낮고 짧게 두어
  // 퍼즐의 진척과 덤으로 얻은 아이템이 귀로도 구분되게 했다.
  apple: () => tone({ frequency: 660, duration: 0.12, type: 'triangle', volume: 0.08, sweepTo: 990 }),
  // 사과가 떨어지는 소리. 바닥에 톡 떨어지듯 아래로 훑는다.
  appleDrop: () =>
    tone({ frequency: 520, duration: 0.09, type: 'sine', volume: 0.045, sweepTo: 300 }),
  clear: () => {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((frequency, i) => {
      window.setTimeout(() => tone({ frequency, duration: 0.24, type: 'sine', volume: 0.12 }), i * 90)
    })
  },
}

/** 설정에 따라 효과음과 진동을 함께 처리한다. */
export function createFeedback(settings) {
  const vibrate = (pattern) => {
    if (!settings.haptics) return
    try {
      navigator.vibrate?.(pattern)
    } catch {
      // 진동을 지원하지 않는 기기는 조용히 넘어간다.
    }
  }

  return {
    step() {
      if (settings.sound) SFX.step()
    },
    push() {
      if (settings.sound) SFX.push()
      vibrate(8)
    },
    goal() {
      if (settings.sound) SFX.goal()
      vibrate(18)
    },
    blocked() {
      if (settings.sound) SFX.blocked()
      vibrate(25)
    },
    undo() {
      if (settings.sound) SFX.undo()
    },
    apple() {
      if (settings.sound) SFX.apple()
      vibrate(12)
    },
    appleDrop() {
      if (settings.sound) SFX.appleDrop()
    },
    clear() {
      if (settings.sound) SFX.clear()
      vibrate([30, 60, 30])
    },
  }
}
