#!/usr/bin/env python3
"""Generate a spoken alert announcement: a short two-tone alarm siren
followed by a Piper-TTS (neural, offline) female-voice announcement of
the attack category, attacker (source) IP, and the target system's
friendly name (not its raw IP -- easier to act on at a glance).

Deliberately does NOT speak the raw Suricata signature text -- an early
version did, and a full signature + a digit-by-digit IP address took
12-15 seconds to speak, too long for a live alert. The signature stays
fully visible in the banner/feed; only the short summary is spoken.

Usage: synth.py <output.wav> <category_label> <src_ip> <target_label>

Voice model is expected at ~/.cache/soc-alarm-dashboard/voices/<VOICE>.onnx
(+ .onnx.json config) -- downloaded once via:
  python3 -m piper.download_voices --download-dir ~/.cache/soc-alarm-dashboard/voices en_US-hfc_female-medium
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

VOICE = "en_US-hfc_female-medium"
VOICES_DIR = Path.home() / ".cache" / "soc-alarm-dashboard" / "voices"
SAMPLE_RATE = 22050


def alarm_tone() -> np.ndarray:
    """Short two-tone siren, attention-grabbing but brief (~0.85s incl. gap)."""
    def tone(freq, dur, vol=0.35):
        t = np.linspace(0, dur, int(SAMPLE_RATE * dur), False)
        return np.sin(freq * t * 2 * np.pi) * vol

    segs = []
    for _ in range(2):
        segs.append(tone(880, 0.15))
        segs.append(tone(660, 0.15))
    gap = np.zeros(int(SAMPLE_RATE * 0.25))
    return np.concatenate(segs + [gap])


def synthesize_speech(text: str) -> np.ndarray:
    model = VOICES_DIR / f"{VOICE}.onnx"
    config = VOICES_DIR / f"{VOICE}.onnx.json"
    if not model.exists():
        raise FileNotFoundError(
            f"Voice model missing: {model}. Download with:\n"
            f"  python3 -m piper.download_voices --download-dir {VOICES_DIR} {VOICE}"
        )
    proc = subprocess.run(
        ["python3", "-m", "piper", "-m", str(model), "-c", str(config), "--output-raw"],
        input=text.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    # --output-raw gives 16-bit PCM mono at the model's sample rate (22050 for this voice)
    return np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float64) / 32768.0


def main():
    if len(sys.argv) != 5:
        print("Usage: synth.py <output.wav> <category_label> <src_ip> <target_label>", file=sys.stderr)
        sys.exit(1)

    out_path, category_label, src_ip, target_label = sys.argv[1:5]
    text = f"{category_label} detected. Source {src_ip}. Target: {target_label}."

    siren = alarm_tone()
    speech = synthesize_speech(text)
    combined = np.concatenate([siren, speech])
    combined = np.clip(combined, -1.0, 1.0)
    pcm = (combined * 32767).astype(np.int16)

    with wave.open(out_path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main()
