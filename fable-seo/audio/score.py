# Ambient bed for the voice-over: slow pad chords, a soft sub and sparse bell plucks. No drums, so
# nothing fights the VO-timed sound effects. Seeded: the same file every run.
#   python3 fable-seo/audio/score.py   -> fable-seo/audio/music.wav (48 kHz stereo, peak -3 dBFS)
import numpy as np
import soundfile as sf
from pathlib import Path

SR, DUR = 48000, 100.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pad(midi, pan, seed):
    """Detuned soft-saw voice (few harmonics, gentle roll-off) with a slow tremolo."""
    r = np.random.default_rng(seed)
    out = np.zeros((N, 2))
    for det in (-0.07, 0.0, 0.06):
        f = hz(midi + det)
        ph = r.uniform(0, 2 * np.pi)
        v = sum(np.sin(2 * np.pi * f * k * t + ph * k) / k ** 2.1 for k in range(1, 7))
        trem = 0.8 + 0.2 * np.sin(2 * np.pi * r.uniform(0.07, 0.16) * t + r.uniform(0, 6))
        p = np.clip(pan + det * 3, -1, 1)
        out[:, 0] += v * trem * (1 - p) / 2
        out[:, 1] += v * trem * (1 + p) / 2
    return out / 3


CHORDS = [  # 10 s each: Dm9, Bbmaj7, Fmaj9, C6/9
    (38, [50, 57, 60, 64, 65]),
    (34, [46, 53, 57, 62, 65]),
    (41, [48, 53, 57, 64, 67]),
    (36, [48, 55, 57, 62, 64]),
]
LEN, XF = 10.0, 3.0
mix = np.zeros((N, 2))
for i in range(int(DUR / LEN) + 1):
    root, notes = CHORDS[i % len(CHORDS)]
    a, b = i * LEN, (i + 1) * LEN
    env = np.clip((t - a + XF / 2) / XF, 0, 1) * np.clip((b + XF / 2 - t) / XF, 0, 1)
    env = np.sin(env * np.pi / 2) ** 2
    if not env.any():
        continue
    voice = np.zeros((N, 2))
    for j, m in enumerate(notes):
        voice += pad(m, pan=(j - 2) * 0.3, seed=100 * i + j) * (0.9 if j < 3 else 0.6)
    sub = np.sin(2 * np.pi * hz(root) * t) * 0.55
    voice += np.stack([sub, sub], axis=1)
    mix += voice * env[:, None]

# sparse bell plucks on chord tones, with a dotted echo
for i in range(int(DUR / 2.5)):
    t0 = 1.2 + i * 2.5 + rng.uniform(-0.3, 0.3)
    _, notes = CHORDS[int(t0 // LEN) % len(CHORDS)]
    f = hz(rng.choice(notes) + 12 * rng.choice([1, 2]))
    pan = rng.uniform(-0.6, 0.6)
    for k, (dly, g) in enumerate([(0, 1.0), (0.375, 0.45), (0.75, 0.2)]):
        s = int((t0 + dly) * SR)
        if s >= N:
            continue
        n = min(N - s, int(2.4 * SR))
        tt = np.arange(n) / SR
        w = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 2.6) * np.minimum(1, tt / 0.004)
        p = pan * (-1) ** k
        mix[s:s + n, 0] += w * g * 0.16 * (1 - p) / 2
        mix[s:s + n, 1] += w * g * 0.16 * (1 + p) / 2

# one-pole low-pass to keep the bed dark, then fades and -3 dBFS peak
from scipy.signal import lfilter
a = np.exp(-2 * np.pi * 2600 / SR)
y = lfilter([1 - a], [1, -a], mix, axis=0)
fade = np.minimum(1, t / 1.5) * np.minimum(1, (DUR - t) / 2.5)
y *= fade[:, None]
y *= 10 ** (-3 / 20) / np.abs(y).max()
out = Path(__file__).resolve().parent / 'music.wav'
sf.write(out, y.astype(np.float32), SR, subtype='PCM_24')
print('wrote', out, f'{DUR:.0f}s')
