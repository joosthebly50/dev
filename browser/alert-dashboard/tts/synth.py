#!/usr/bin/env python3
"""Generate a spoken alert announcement: a short two-tone alarm siren
followed by a Piper-TTS (neural, offline) female-voice announcement of
the attack category, source, and target.

Deliberately does NOT speak the raw Suricata signature text -- an early
version did, and a full signature + a digit-by-digit IP address took
12-15 seconds to speak, too long for a live alert. The signature stays
fully visible in the banner/feed; only the short summary is spoken.

Two modes:
  normal (default): "<Category> detected. Source <src>. Target: <target>."
  --verbose (Critical/High alerts, SOC Dashboard v2 roadmap):
    "Warning. <Category> detected from <src> to <target>."
  Caller (server.mjs) decides whether src/target are raw IPs or resolved
  hostnames -- this script just speaks whatever strings it's given.

Usage: synth.py <output.wav> <category_label> <src> <target> [--verbose]

Voice model is expected at ~/.cache/soc-alarm-dashboard/voices/<VOICE>.onnx
(+ .onnx.json config) -- downloaded once via:
  python3 -m piper.download_voices --download-dir ~/.cache/soc-alarm-dashboard/voices en_US-hfc_female-medium
"""
import argparse
import subprocess
import wave
from pathlib import Path

import numpy as np

DEFAULT_VOICE = "en_US-amy-medium"
VOICES_DIR = Path.home() / ".cache" / "soc-alarm-dashboard" / "voices"
SAMPLE_RATE = 22050

# The four female English voices downloaded and compared live 2026-07-15
# (docs/guides/alarm_dashboard.md) -- server.mjs validates the client's
# requested voice name against this same set before ever reaching this
# script, so an unrecognized name here means that check was bypassed.
KNOWN_VOICES = {
    "en_US-hfc_female-medium",
    "en_US-amy-medium",
    "en_US-kristin-medium",
    "en_US-ljspeech-medium",
    "en_US-ljspeech-high",
    "en_GB-jenny_dioco-medium",
    "en_GB-alba-medium",
    "en_GB-cori-medium",
    "en_GB-semaine-medium",
    "en_GB-aru-medium",
    "en_US-hfc_male-medium",
    "en_US-norman-medium",
    "en_US-bryce-medium",
    "en_GB-alan-medium",
}


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


def synthesize_speech(text: str, voice: str, rate: float) -> np.ndarray:
    model = VOICES_DIR / f"{voice}.onnx"
    config = VOICES_DIR / f"{voice}.onnx.json"
    if not model.exists():
        raise FileNotFoundError(
            f"Voice model missing: {model}. Download with:\n"
            f"  python3 -m piper.download_voices --download-dir {VOICES_DIR} {voice}"
        )
    # Piper's --length-scale is inverse of speed (lower = faster); "rate"
    # is exposed to the user as a plain speed multiplier (server.mjs),
    # converted here.
    length_scale = 1.0 / max(rate, 0.1)
    proc = subprocess.run(
        [
            "python3", "-m", "piper", "-m", str(model), "-c", str(config),
            "--length-scale", str(length_scale), "--output-raw",
        ],
        input=text.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    # --output-raw gives 16-bit PCM mono at the model's sample rate (22050 for this voice)
    return np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float64) / 32768.0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    parser.add_argument("category_label")
    parser.add_argument("source")
    parser.add_argument("target")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--multiple", action="store_true", help="Repeat announcement of the same category (cooldown-triggered, not new/escalation) -- speak a calmer grouped summary instead of repeating the full sentence")
    parser.add_argument("--voice", default=DEFAULT_VOICE, choices=sorted(KNOWN_VOICES))
    parser.add_argument("--rate", type=float, default=1.0)
    parser.add_argument("--text", default=None, help="Speak this exact text instead of building an alert sentence (voice preview)")
    args = parser.parse_args()

    if args.text:
        text = args.text
    elif args.multiple:
        text = f"Multiple {args.category_label} events detected."
    elif args.verbose:
        text = f"Warning. {args.category_label} detected from {args.source} to {args.target}."
    else:
        text = f"{args.category_label} detected from {args.source} against {args.target}."

    # Skip the siren for a plain --text preview (e.g. "listen to this voice"
    # while adjusting settings) -- it reads as a real alert otherwise.
    speech = synthesize_speech(text, args.voice, args.rate)
    combined = speech if args.text else np.concatenate([alarm_tone(), speech])
    combined = np.clip(combined, -1.0, 1.0)
    pcm = (combined * 32767).astype(np.int16)

    with wave.open(args.output, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main()
