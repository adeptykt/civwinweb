#!/usr/bin/env python3
"""
Convert Civilization 1 / OpenCiv1-style .pic files to PNG.

Decoding matches OpenCiv1 (rajko-horvat/OpenCiv1): block container, palette 0x304d,
image 0x3058 (8bpp) or 0x3158 (packed nibbles), LZW then RLE.

Batch: pass a folder as INPUT — every *.pic in that folder (non-recursive) is converted.
Optional OUTPUT folder receives all PNGs; if omitted, PNGs are written next to each .pic.

Requires: pip install pillow
"""

from __future__ import annotations

import argparse
import io
import struct
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as e:
    raise SystemExit("Install Pillow: pip install pillow") from e


def color18_to_rgb(red: int, green: int, blue: int) -> tuple[int, int, int]:
    return (
        (255 * (red & 0x3F)) // 63,
        (255 * (green & 0x3F)) // 63,
        (255 * (blue & 0x3F)) // 63,
    )


def rle_decompress(data: bytes) -> bytes:
    out = bytearray()
    ub_old_value = 0
    i = 0
    n = len(data)
    while i < n:
        c = data[i]
        i += 1
        if c == 0x90:
            if i >= n:
                break
            i_length = data[i]
            i += 1
            if i_length == 0:
                ub_old_value = 0x90
                out.append(ub_old_value)
            else:
                for _ in range(1, i_length):
                    out.append(ub_old_value)
        else:
            ub_old_value = c
            out.append(ub_old_value)
    return bytes(out)


def lzw_decompress(data: bytes, start_bit_count: int, max_bit_count: int) -> bytes:
    """LZW decompress as in OpenCiv1/src/Game/Compression/LZW.cs Decompress."""
    input_pos = 0
    i_input_data = 0
    i_input_length = 0
    i_bit_count = start_bit_count
    i_bit_mask = (1 << i_bit_count) - 1
    dict_list: list[bytes] = [bytes([j]) for j in range(256)]
    w = bytearray([0])
    output = bytearray()

    def read_byte() -> int:
        nonlocal input_pos
        if input_pos >= len(data):
            return -1
        b = data[input_pos]
        input_pos += 1
        return b

    while True:
        while i_input_length < i_bit_count:
            c = read_byte()
            if c < 0:
                break
            i_input_data |= c << i_input_length
            i_input_length += 8

        if i_input_length < i_bit_count:
            break

        i_new_value = i_input_data & i_bit_mask

        if i_new_value == 256:
            raise ValueError("LZW: reserved code 256 in stream")

        i_input_length -= i_bit_count
        i_input_data >>= i_bit_count

        entry = bytearray()
        if i_new_value < len(dict_list):
            entry.extend(dict_list[i_new_value])
        elif i_new_value == len(dict_list):
            entry.extend(w)
            if len(w) > 0:
                entry.append(w[0])

        output.extend(entry)

        if len(entry) > 0:
            w.append(entry[0])

        if len(dict_list) >= i_bit_mask:
            i_bit_count += 1
            i_bit_mask = (1 << i_bit_count) - 1

        if i_bit_count > max_bit_count:
            i_bit_count = start_bit_count
            i_bit_mask = (1 << i_bit_count) - 1
            dict_list = [bytes([j]) for j in range(256)]
            w = bytearray([0])
        else:
            if len(w) > 0:
                dict_list.append(bytes(w))
            w = bytearray(entry)

    return bytes(output)


def _palette_list_to_rgb256(a_palette: list[tuple[int, tuple[int, int, int]]]) -> list[tuple[int, int, int]]:
    pal256: list[tuple[int, int, int]] = [(0, 0, 0)] * 256
    for idx, rgb in a_palette:
        if 0 <= idx < 256:
            pal256[idx] = rgb
    return pal256


def decode_pic(data: bytes, prefer_hi_color: bool = True) -> tuple[Image.Image, str]:
    """
    Decode .pic bytes to a PIL RGB image.
    Returns (image, note) where note describes which image block was used.
    """
    i = 0
    a_palette: list[tuple[int, tuple[int, int, int]]] = []
    bitmap: dict | None = None
    mode_note = ""

    while True:
        if i + 4 > len(data):
            break
        sig = data[i] | (data[i + 1] << 8)
        blk_len = data[i + 2] | (data[i + 3] << 8)
        i += 4
        if sig < 0 or blk_len < 0:
            break
        if i + blk_len > len(data):
            raise ValueError(
                f"Block 0x{sig:04x}: truncated file (need {blk_len} bytes at offset {i})"
            )
        block = data[i : i + blk_len]
        i += blk_len

        if sig == 0x3045:
            if len(a_palette) == 0 or not prefer_hi_color:
                a_palette.clear()
        elif sig == 0x304D:
            if len(a_palette) == 0 or prefer_hi_color:
                a_palette.clear()
                if len(block) < 2:
                    raise ValueError("Palette block 0x304d too short")
                i_index = block[0]
                i_color_end = block[1]
                i_color_count = i_color_end - i_index + 1
                p = 2
                for k in range(i_color_count):
                    if p + 3 > len(block):
                        raise ValueError("Palette block 0x304d truncated")
                    r, g, b = block[p], block[p + 1], block[p + 2]
                    p += 3
                    a_palette.append((i_index + k, color18_to_rgb(r, g, b)))
        elif sig == 0x3058:
            if bitmap is None or prefer_hi_color:
                if len(block) < 5:
                    raise ValueError("Image block 0x3058 too short")
                w = struct.unpack("<H", block[0:2])[0]
                h = struct.unpack("<H", block[2:4])[0]
                i_max_bits = block[4]
                rest = block[5:]
                if i_max_bits <= 7:
                    raise ValueError("Image block 0x3058: max bits must be > 7")
                lzw_out = lzw_decompress(rest, 9, i_max_bits)
                rle_out = rle_decompress(lzw_out)
                need = w * h
                pixels = rle_out[:need]
                if len(pixels) < need:
                    pixels = pixels + bytes(need - len(pixels))
                bitmap = {"w": w, "h": h, "pixels": pixels, "packed": False}
                mode_note = "0x3058 8bpp"
        elif sig == 0x3158:
            if bitmap is None or not prefer_hi_color:
                if len(block) < 5:
                    raise ValueError("Image block 0x3158 too short")
                w = struct.unpack("<H", block[0:2])[0]
                h = struct.unpack("<H", block[2:4])[0]
                i_max_bits = block[4]
                rest = block[5:]
                if i_max_bits <= 7:
                    raise ValueError("Image block 0x3158: max bits must be > 7")
                lzw_out = lzw_decompress(rest, 9, i_max_bits)
                rle_out = rle_decompress(lzw_out)
                pixels = bytearray()
                pr = io.BytesIO(rle_out)
                for _row in range(h):
                    j = 0
                    while j < w:
                        c = pr.read(1)
                        if not c:
                            break
                        b0 = c[0]
                        pixels.append(b0 & 0x0F)
                        j += 1
                        if j < w:
                            pixels.append((b0 >> 4) & 0x0F)
                            j += 1
                need = w * h
                while len(pixels) < need:
                    pixels.append(0)
                pixels = bytes(pixels[:need])
                bitmap = {"w": w, "h": h, "pixels": pixels, "packed": True}
                mode_note = "0x3158 4bpp"
        else:
            raise ValueError(f"Unknown PIC block signature 0x{sig:04x}")

    if bitmap is None:
        raise ValueError("No image block (0x3058 or 0x3158) found in PIC")

    pal256 = _palette_list_to_rgb256(a_palette)
    w, h = bitmap["w"], bitmap["h"]
    pix = bitmap["pixels"]
    rgb = bytearray(w * h * 3)
    o = 0
    for pidx in pix:
        r, g, b = pal256[pidx]
        rgb[o] = r
        rgb[o + 1] = g
        rgb[o + 2] = b
        o += 3
    img = Image.frombytes("RGB", (w, h), bytes(rgb))
    return img, mode_note


def list_pic_files_in_dir(directory: Path) -> list[Path]:
    """All direct children with extension .pic (case-insensitive)."""
    files: list[Path] = []
    for p in directory.iterdir():
        if p.is_file() and p.suffix.lower() == ".pic":
            files.append(p)
    return sorted(files, key=lambda x: x.name.lower())


def convert_one(
    pic_path: Path,
    png_path: Path,
    *,
    prefer_hi_color: bool,
    quiet: bool,
) -> None:
    data = pic_path.read_bytes()
    img, note = decode_pic(data, prefer_hi_color=prefer_hi_color)
    png_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(png_path, format="PNG")
    if not quiet:
        print(f"Wrote {png_path} ({img.size[0]}x{img.size[1]}, {note})", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Convert Civ1 .pic to PNG (OpenCiv1-compatible decode). "
        "Pass a file or a folder of .pic files; optional second path is output file or output folder."
    )
    ap.add_argument("input", type=Path, metavar="INPUT", help="Source .pic file, or folder containing .pic files")
    ap.add_argument(
        "output",
        type=Path,
        nargs="?",
        metavar="OUTPUT",
        help="Output .png file, or folder for PNGs when INPUT is a folder (default: next to each .pic)",
    )
    ap.add_argument(
        "--no-prefer-hi-color",
        action="store_false",
        dest="prefer_hi_color",
        default=True,
        help="Use 4bpp packed path (0x3158) like OpenCiv1 with preferHiColor=false",
    )
    ap.add_argument("-q", "--quiet", action="store_true", help="No stderr info line")
    args = ap.parse_args()

    inp = args.input
    out = args.output

    if not inp.exists():
        raise SystemExit(f"Not found: {inp}")

    if inp.is_dir():
        pics = list_pic_files_in_dir(inp)
        if not pics:
            raise SystemExit(f"No .pic files in folder: {inp}")

        if out is not None:
            if out.exists() and not out.is_dir():
                raise SystemExit(
                    f"When INPUT is a folder, OUTPUT must be a folder (or not exist yet); got a file: {out}"
                )
            out_dir = out
            out_dir.mkdir(parents=True, exist_ok=True)
        else:
            out_dir = inp

        errors = 0
        for pic in pics:
            png = out_dir / (pic.stem + ".png")
            try:
                convert_one(pic, png, prefer_hi_color=args.prefer_hi_color, quiet=args.quiet)
            except Exception as e:
                errors += 1
                print(f"Error: {pic.name}: {e}", file=sys.stderr)
        if errors:
            raise SystemExit(errors)
        return

    # Single file
    if not inp.is_file():
        raise SystemExit(f"Not a file or folder: {inp}")

    if out is None:
        png_path = inp.with_suffix(".png")
    elif out.exists() and out.is_dir():
        png_path = out / (inp.stem + ".png")
    elif out.exists() and out.is_file():
        png_path = out
    elif out.suffix.lower() == ".png":
        png_path = out
    else:
        # New path without .png: treat as output directory (e.g. .../exports)
        out.mkdir(parents=True, exist_ok=True)
        png_path = out / (inp.stem + ".png")

    try:
        convert_one(inp, png_path, prefer_hi_color=args.prefer_hi_color, quiet=args.quiet)
    except Exception as e:
        raise SystemExit(str(e)) from e


if __name__ == "__main__":
    main()
