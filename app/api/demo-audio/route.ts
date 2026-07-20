const SAMPLE_RATE = 8_000;
const DURATION_SECONDS = 32;

function createDemoWave() {
  const sampleCount = SAMPLE_RATE * DURATION_SECONDS;
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < sampleCount; index += 1) {
    const pulse = index % (SAMPLE_RATE * 6) < 420 ? Math.sin((index / SAMPLE_RATE) * Math.PI * 2 * 220) * 0.035 : 0;
    view.setInt16(44 + index * 2, Math.round(pulse * 32767), true);
  }
  return new Uint8Array(buffer);
}

export async function GET(request: Request) {
  const audio = createDemoWave();
  const range = request.headers.get("range");
  const commonHeaders = {
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=86400",
    "content-type": "audio/wav",
  };
  if (!range) {
    return new Response(audio, { headers: { ...commonHeaders, "content-length": String(audio.byteLength) } });
  }
  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) return new Response(null, { status: 416 });
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), audio.byteLength - 1) : audio.byteLength - 1;
  if (start > end || start >= audio.byteLength) return new Response(null, { status: 416 });
  const chunk = audio.slice(start, end + 1);
  return new Response(chunk, {
    status: 206,
    headers: {
      ...commonHeaders,
      "content-length": String(chunk.byteLength),
      "content-range": `bytes ${start}-${end}/${audio.byteLength}`,
    },
  });
}
