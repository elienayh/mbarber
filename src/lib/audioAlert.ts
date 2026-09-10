// Alerta Sonoro agradável usando a Web Audio API (sem necessidade de arquivos de áudio externos)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn("Web Audio API não suportada ou bloqueada:", err);
    return null;
  }
}

/**
 * Toca um chime melódico agradável de 3 notas (Dó -> Mi -> Sol / 523Hz -> 659Hz -> 784Hz)
 * simulando um sinal de notificação moderna para novos agendamentos da barbearia.
 */
export function playNotificationChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0, duration: 0.12 },     // C5
      { freq: 659.25, time: 0.1, duration: 0.14 },    // E5
      { freq: 783.99, time: 0.22, duration: 0.35 },   // G5
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      // Curva suave de ataque e decaimento
      gain.gain.setValueAtTime(0.001, now + note.time);
      gain.gain.exponentialRampToValueAtTime(0.3, now + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration);
    });
  } catch (err) {
    console.warn("Erro ao reproduzir alerta sonoro de agendamento:", err);
  }
}
