"""Pack PNGs into a macOS .icns file (pure Python, no iconutil needed).

Usage: python3 build/pack-icns.py <master-1024.png> <out.icns>

Resizes the master with PIL and writes PNG-compressed icon elements:
icp4=16, ic11=32, ic12=64, ic07=128, ic08=256, ic09=512, ic10=1024.
"""
import io
import struct
import sys

from PIL import Image

ELEMENTS = (
    ("icp4", 16),
    ("ic11", 32),
    ("ic12", 64),
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
)


def main(master_path: str, out_path: str) -> None:
    master = Image.open(master_path).convert("RGBA")
    if master.size != (1024, 1024):
        print(f"warning: master is {master.size}, expected 1024x1024", file=sys.stderr)
    body = b""
    for ostype, size in ELEMENTS:
        frame = master.resize((size, size), Image.LANCZOS)
        buf = io.BytesIO()
        frame.save(buf, format="PNG")
        data = buf.getvalue()
        body += ostype.encode("ascii") + struct.pack(">I", 8 + len(data)) + data
    with open(out_path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", 8 + len(body)) + body)
    print(f"wrote {out_path} ({8 + len(body)} bytes, {len(ELEMENTS)} elements)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
