export const NOTIFICATION_SOUNDS = [
  { id: 'chime', label: 'Chime' },
  { id: 'ping', label: 'Ping' },
  { id: 'soft', label: 'Soft' },
  { id: 'bell', label: 'Bell' },
] as const

function playChime(ctx: AudioContext) {
  // Two-note chime: D5 then A5
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.value = 587.33
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  gain1.gain.setValueAtTime(0.12, ctx.currentTime)
  gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
  osc1.start(ctx.currentTime)
  osc1.stop(ctx.currentTime + 0.35)

  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.value = 880
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.12)
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  osc2.start(ctx.currentTime + 0.12)
  osc2.stop(ctx.currentTime + 0.5)
}

function playPing(ctx: AudioContext) {
  // Single short high-pitched ping
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 1760
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.15)
}

function playSoft(ctx: AudioContext) {
  // Gentle low sine wave fade
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 330
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.8)
}

function playBell(ctx: AudioContext) {
  // Classic bell-like tone with harmonics
  const frequencies = [523.25, 1046.5, 1568]
  const gains = [0.1, 0.06, 0.03]

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(gains[i], ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  })
}

const SOUND_PLAYERS: Record<string, (ctx: AudioContext) => void> = {
  chime: playChime,
  ping: playPing,
  soft: playSoft,
  bell: playBell,
}

export function playNotificationSound(soundId: string): void {
  try {
    const ctx = new AudioContext()
    const player = SOUND_PLAYERS[soundId] || SOUND_PLAYERS.chime
    player(ctx)
    setTimeout(() => ctx.close(), 1500)
  } catch {
    // Audio not available
  }
}
