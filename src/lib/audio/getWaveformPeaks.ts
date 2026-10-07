export async function getWaveformPeaks(audioUrl: string, barCount: number = 32): Promise<number[]> {
  try {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const samplesPerBar = Math.floor(rawData.length / barCount);

    const peaks: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const start = i * samplesPerBar;
      let sum = 0;
      for (let j = 0; j < samplesPerBar; j++) {
        sum += Math.abs(rawData[start + j] || 0);
      }
      peaks.push(sum / samplesPerBar);
    }

    const max = Math.max(...peaks, 0.001);
    return peaks.map((p) => Math.max(0.15, p / max));
  } catch (err) {
    console.error("Waveform extraction failed:", err);
    return Array.from({ length: barCount }, () => 0.3 + Math.random() * 0.4);
  }
}