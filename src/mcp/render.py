#!/usr/bin/env python3
"""StoreShot headless export renderer (PIL-based, stdlib + Pillow only).

Reads an export job (JSON) from a file path given as argv[1], renders each
unit to a PNG at the exact target size, packs them into a ZIP whose internal
paths come from the job, and prints a manifest JSON to stdout.

Geometry mirrors src/components/editor/slide-canvas.tsx + device-frames.tsx:
same canvas sizes, caption rects, typography factors, frame insets and Blob
placement. Rendering is per-screen (Isolated-mode semantics): in connected
mode the full strip is composited first so straddling elements split across
screens exactly like the browser export, then cropped per screen.

Logs and errors go to stderr. Stdout carries ONLY the manifest JSON.
"""

import json
import math
import os
import sys
import tempfile
import traceback
import urllib.request
import zipfile

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageStat
    HAVE_PIL = True
except Exception:
    HAVE_PIL = False


def err(msg):
    sys.stderr.write("render: %s\n" % msg)
    sys.stderr.flush()


# ---------- color utils (port of shade() in slide-canvas.tsx) ----------

def parse_hex(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def to_hex(rgb):
    r, g, b = [max(0, min(255, int(round(v)))) for v in rgb]
    return "#%02x%02x%02x" % (r, g, b)


def shade(hex_color, percent):
    r, g, b = parse_hex(hex_color)
    amt = round(255 * percent / 100)
    return to_hex((r + amt, g + amt, b + amt))


def with_alpha(rgb, a):
    return (int(rgb[0]), int(rgb[1]), int(rgb[2]), int(a))


# ---------- fonts (Google Fonts css2 with a woff2-less UA -> TTF) ----------

CSS_UA = "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0)"
try:
    FONT_TIMEOUT = max(1, int(os.environ.get("STORESHOT_FONT_TIMEOUT", "15")))
except ValueError:
    FONT_TIMEOUT = 15


class Fonts:
    def __init__(self, cache_dir):
        self.cache = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        self.memo = {}
        self.fell_back = set()

    def _css_urls(self, family, weights):
        fam = family.replace(" ", "+")
        url = "https://fonts.googleapis.com/css2?family=%s:wght@%s&display=swap" % (
            fam, ";".join(str(w) for w in sorted(set(weights))))
        req = urllib.request.Request(url, headers={"User-Agent": CSS_UA})
        with urllib.request.urlopen(req, timeout=FONT_TIMEOUT) as r:
            css = r.read().decode("utf-8", "replace")
        out = {}
        for block in css.split("@font-face"):
            if "format('truetype')" not in block and 'format("truetype")' not in block:
                continue
            import re
            wm = re.search(r"font-weight:\s*(\d+)", block)
            um = re.search(r"url\((https://[^)]+)\)", block)
            if wm and um:
                out.setdefault(int(wm.group(1)), um.group(1))
        return out

    def _download(self, family, weight, url):
        safe = "".join(c if c.isalnum() else "-" for c in family)
        dest = os.path.join(self.cache, "%s-%d.ttf" % (safe, weight))
        if os.path.exists(dest) and os.path.getsize(dest) > 1024:
            return dest
        tmp = dest + ".part"
        req = urllib.request.Request(url, headers={"User-Agent": CSS_UA})
        with urllib.request.urlopen(req, timeout=FONT_TIMEOUT) as r, open(tmp, "wb") as f:
            f.write(r.read())
        os.replace(tmp, dest)
        return dest

    def _system_fallback(self):
        for p in ("/System/Library/Fonts/Helvetica.ttc",
                  "/System/Library/Fonts/HelveticaNeue.ttc",
                  "/Library/Fonts/Arial Unicode.ttf"):
            if os.path.exists(p):
                return p
        return None

    def path_for(self, family, weight):
        key = (family, weight)
        if key in self.memo:
            return self.memo[key]
        path = None
        try:
            urls = self._css_urls(family, [weight])
            url = urls.get(weight) or next(iter(urls.values()), None)
            if url:
                path = self._download(family, weight, url)
        except Exception as e:
            err("font download failed for %s %d: %s" % (family, weight, e))
        if path is None:
            path = self._system_fallback()
            self.fell_back.add(key)
        self.memo[key] = path
        return path

    def font(self, family, size, weight):
        size = max(8, int(round(size)))
        path = self.path_for(family, weight)
        try:
            if path and path.endswith(".ttc"):
                return ImageFont.truetype(path, size, index=0)
            if path:
                return ImageFont.truetype(path, size)
        except Exception as e:
            err("font load failed %s: %s" % (path, e))
        return ImageFont.load_default(size=size) if hasattr(ImageFont, "load_default") else ImageFont.load_default()


# ---------- image loading / cover-fit ----------

def load_image(path):
    try:
        im = Image.open(path)
        im.load()
        return im.convert("RGB")
    except Exception as e:
        err("cannot load image %s: %s" % (path, e))
        return None


def cover_fit(im, w, h, from_top=True):
    """object-fit:cover + object-position:top over a w×h box."""
    w, h = int(w), int(h)
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    im = im.resize((nw, nh), Image.LANCZOS)
    x = (nw - w) // 2
    y = 0 if from_top else (nh - h) // 2
    return im.crop((x, y, x + w, y + h))


def resolve_upload(workspace, rel, locale):
    """Mirror resolveScreenshot + screenshots/ scoping (TS side pre-resolves
    {locale}; here we just map to disk). Returns an absolute path or None."""
    if not rel or rel.startswith("data:"):
        return None
    p = rel.replace("{locale}", locale or "en")
    if os.path.isabs(p):
        cand = p
    else:
        cand = os.path.join(workspace, "screenshots", p.lstrip("/"))
    if os.path.isfile(cand):
        return cand
    # legacy workspace-root fallback (mirrors project route fallback)
    alt = os.path.join(workspace, p.lstrip("/"))
    return alt if os.path.isfile(alt) else None


# ---------- smooth background layers (rendered small, then upscaled) ----------

BG_SCALE = 4  # gradients/blobs are smooth: render at 1/4 then upscale


def angled_gradient(w, h, top_hex, bottom_hex, angle_deg):
    sw, sh = max(2, w // BG_SCALE), max(2, h // BG_SCALE)
    top = parse_hex(top_hex)
    bot = parse_hex(bottom_hex)
    rad = math.radians(angle_deg)
    dx, dy = math.sin(rad), -math.cos(rad)
    cx, cy = (sw - 1) / 2.0, (sh - 1) / 2.0
    proj = [dx * (x - cx) + dy * (y - cy) for y in range(sh) for x in range(sw)]
    lo, hi = min(proj), max(proj)
    span = (hi - lo) or 1.0
    px = bytearray(sw * sh * 3)
    for i, t in enumerate(proj):
        k = (t - lo) / span
        px[i * 3] = int(round(top[0] + (bot[0] - top[0]) * k))
        px[i * 3 + 1] = int(round(top[1] + (bot[1] - top[1]) * k))
        px[i * 3 + 2] = int(round(top[2] + (bot[2] - top[2]) * k))
    return Image.frombytes("RGB", (sw, sh), bytes(px)).resize((w, h), Image.BILINEAR)


def radial_blob_mask(w, h):
    """White-center elliptical falloff mask, full size, blurred."""
    sw, sh = max(2, w // BG_SCALE), max(2, h // BG_SCALE)
    m = Image.new("L", (sw, sh), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([0, 0, sw - 1, sh - 1], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(max(1, min(sw, sh) // 14)))
    return m.resize((w, h), Image.BILINEAR)


def paint_blob(base, color_hex, cx_frac, cy_frac, size_frac, opacity):
    """Blob() port: circle of size_frac*W at (cx,cy) fractions, blurred."""
    w, h = base.size
    rgb = parse_hex(color_hex)
    d = max(1, int(round(w * size_frac)))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = int(round(cx_frac * w - d / 2))
    y = int(round(cy_frac * h - d / 2))
    # soft edge baked in: draw at 1/2 res with blur, then upscale
    small = Image.new("L", (max(2, d // 2), max(2, d // 2)), 0)
    ds = ImageDraw.Draw(small)
    ds.ellipse([0, 0, small.size[0] - 1, small.size[1] - 1], fill=255)
    small = small.filter(ImageFilter.GaussianBlur(max(1, small.size[0] // 12)))
    mask = Image.new("L", (w, h), 0)
    mask.paste(small.resize((d, d), Image.BILINEAR), (x, y))
    solid = Image.new("RGBA", (w, h), with_alpha(rgb, int(255 * opacity)))
    base.alpha_composite(Image.composite(solid, Image.new("RGBA", (w, h), (0, 0, 0, 0)), mask))
    return base


def mesh_layer(w, h, colors, angle):
    c0 = colors[0]
    c1 = colors[1] if len(colors) > 1 else c0
    c2 = colors[2] if len(colors) > 2 else c0
    c3 = colors[3] if len(colors) > 3 else c1
    base = shade(c0, -14)
    img = angled_gradient(w, h, base, shade(base, -10), angle).convert("RGBA")
    # radial-gradient(at 12% 6%, c1 0%, transparent 55%) etc: solid disc sized
    # so its opaque core covers the stop distance, feathered beyond. CSS
    # paints the FIRST listed gradient on top, so composite in reverse.
    for (color, fx, fy, stop) in ((c3, 0.50, 1.05, 0.60), (c2, 0.88, 0.14, 0.52), (c1, 0.12, 0.06, 0.55)):
        rgb = parse_hex(color)
        r = int(round(max(w, h) * stop))
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.ellipse([fx * w - r, fy * h - r, fx * w + r, fy * h + r], fill=with_alpha(rgb, 255))
        mask = radial_blob_mask(2 * r + 8, 2 * r + 8)
        soft = Image.new("L", (w, h), 0)
        soft.paste(mask, (int(round(fx * w - r)) - 4, int(round(fy * h - r)) - 4))
        img.alpha_composite(Image.composite(layer, Image.new("RGBA", (w, h), (0, 0, 0, 0)), soft))
    return img


def theme_layer(w, h, theme, inverted):
    if inverted:
        top, bottom = theme["bgAlt"], shade(theme["bgAlt"], -8)
    else:
        top, bottom = theme["bg"], shade(theme["bg"], -6)
    img = angled_gradient(w, h, top, bottom, 160).convert("RGBA")
    inv = bool(inverted)
    # Blob colors/positions mirror SlideBackground: accent at (-15%,-10%,55%)
    # and (70%,75%,45%).
    img = paint_blob(img, theme["accent"], -0.15 + 0.275, -0.10 + 0.275, 0.55, 0.25 if inv else 0.32)
    img = paint_blob(img, theme["accent"], 0.70 + 0.225, 0.75 + 0.225, 0.45, 0.18 if inv else 0.25)
    return img


def render_background(w, h, bg, default_bg, theme, inverted, workspace, locale, warnings):
    """SlideBackground port. Returns an RGBA layer."""
    b = dict(bg or {})
    if b.get("kind") == "image" and b.get("src"):
        p = resolve_upload(workspace, b["src"], locale)
        im = load_image(p) if p else None
        if im is not None:
            layer = cover_fit(im, w, h).convert("RGBA")
        else:
            warnings.append("background image missing: %s" % b["src"])
            layer = theme_layer(w, h, theme, inverted)
    elif b.get("kind") == "mesh" and isinstance(b.get("colors"), list) and len(b["colors"]) >= 2:
        layer = mesh_layer(w, h, b["colors"], b.get("angle", 160) or 160)
    elif b.get("kind") == "image":
        layer = theme_layer(w, h, theme, inverted)
    elif default_bg is not None and b.get("kind") is None:
        return render_background(w, h, default_bg, None, theme, inverted, workspace, locale, warnings)
    else:
        # kind theme (or anything unknown) -> theme gradient
        layer = theme_layer(w, h, theme, inverted)
    # style tweaks shared by every kind
    try:
        op = float(b.get("opacity", 1))
    except (TypeError, ValueError):
        op = 1.0
    op = max(0.0, min(1.0, op))
    if op < 1.0:
        a = layer.getchannel("A").point(lambda v: int(v * op))
        layer.putalpha(a)
    try:
        blur = float(b.get("blur", 0) or 0)
    except (TypeError, ValueError):
        blur = 0.0
    if blur > 0:
        layer = layer.filter(ImageFilter.GaussianBlur(min(40.0, blur)))
    return layer


# ---------- text ----------

def draw_tracked_text(canvas, cx, y, text, font, fill, tracking):
    """Single centered line with letter-spacing (label port). Returns bottom y."""
    d = ImageDraw.Draw(canvas)
    widths = []
    for ch in text:
        bb = d.textbbox((0, 0), ch, font=font)
        widths.append(bb[2] - bb[0])
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = cx - total / 2.0
    asc, desc = font.getmetrics()
    for ch, wch in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += wch + tracking
    return y + (asc + desc)


def text_size(font, text):
    bb = font.getbbox(text)
    return (bb[2] - bb[0], bb[3] - bb[1])


def draw_centered_block(canvas, cx, y_top, lines, font, fill, line_height, tracking=0):
    """Multiline centered block (headline port). Returns bottom y."""
    y = y_top
    for line in lines:
        if line == "":
            y += line_height
            continue
        if tracking:
            y = draw_tracked_text(canvas, cx, y, line, font, fill, tracking)
            y += line_height - font.getmetrics()[0] - font.getmetrics()[1]
        else:
            d = ImageDraw.Draw(canvas)
            asc, desc = font.getmetrics()
            d.text((cx, y + asc), line, font=font, fill=fill, anchor="ma")
            y += line_height
    return y


# ---------- layout geometry (port of getDefaultRects + phoneW/tabletW) ----------

MK_RATIO = 425 / 900
IPAD_MK_RATIO = 0.7595
DESKTOP_RATIO = 2880 / 1800


def frame_width_frac(cW, cH, clamp, aspect):
    return min(clamp, 0.72 * (cH / cW) * aspect)


def default_rects(layout, cW, cH, frame_aspect, fw_frac, fw_small_frac):
    deviceW = fw_frac * cW
    deviceH = deviceW / frame_aspect
    smallW = fw_small_frac * cW
    smallH = smallW / frame_aspect
    capW = cW * 0.84
    capH = cH * 0.28
    if layout == "hero":
        return {
            "caption": {"x": cW * 0.08, "y": cH * 0.09, "w": capW, "h": capH, "align": "center"},
            "device": {"x": (cW - deviceW) / 2, "y": cH - deviceH + deviceH * 0.15, "w": deviceW, "h": deviceH},
        }
    if layout == "device-bottom":
        return {
            "caption": {"x": cW * 0.08, "y": cH * 0.08, "w": capW, "h": capH, "align": "center"},
            "device": {"x": (cW - deviceW) / 2, "y": cH - deviceH - cH * 0.02, "w": deviceW, "h": deviceH},
        }
    if layout == "device-top":
        return {
            "caption": {"x": cW * 0.08, "y": cH * 0.65, "w": capW, "h": capH, "align": "center"},
            "device": {"x": (cW - deviceW) / 2, "y": -cH * 0.1, "w": deviceW, "h": deviceH},
        }
    if layout == "two-devices":
        return {
            "caption": {"x": cW * 0.08, "y": cH * 0.08, "w": capW, "h": capH, "align": "center"},
            "deviceSecondary": {"x": -cW * 0.06, "y": cH - smallH - cH * 0.05, "w": smallW, "h": smallH},
            "device": {"x": cW - deviceW * 0.9 + cW * 0.06, "y": cH - deviceH * 0.9 - cH * 0.02,
                       "w": deviceW * 0.9, "h": (deviceW * 0.9) / frame_aspect},
        }
    if layout == "no-device":
        return {"caption": {"x": cW * 0.1, "y": cH * 0.35, "w": cW * 0.8, "h": cH * 0.3, "align": "center"}}
    return {}


def pick_text(field, locale):
    field = field or {}
    v = field.get(locale)
    if v:
        return v
    v = field.get("en")
    if v:
        return v
    for k in field:
        if field[k]:
            return field[k]
    return ""


def composite_at(base, layer, x, y):
    """alpha_composite with clipping (PIL rejects out-of-bounds dest)."""
    x, y = int(round(x)), int(round(y))
    sx0, sy0 = max(0, -x), max(0, -y)
    dx0, dy0 = max(0, x), max(0, y)
    w = min(layer.size[0] - sx0, base.size[0] - dx0)
    h = min(layer.size[1] - sy0, base.size[1] - dy0)
    if w <= 0 or h <= 0:
        return
    base.alpha_composite(layer.crop((sx0, sy0, sx0 + w, sy0 + h)), (dx0, dy0))


def paste_rotated(base, layer, cx, cy, angle, flip_h=False, flip_v=False):
    """Paste RGBA layer centered at (cx,cy), rotated by angle degrees."""
    if flip_h:
        layer = layer.transpose(Image.FLIP_LEFT_RIGHT)
    if flip_v:
        layer = layer.transpose(Image.FLIP_TOP_BOTTOM)
    if angle:
        layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    composite_at(base, layer, cx - layer.size[0] / 2, cy - layer.size[1] / 2)


def paste_about(base, layer, ox, oy, pivx, pivy, css_angle, flip_h=False, flip_v=False):
    """Paste layer with origin (ox,oy), rotated about pivot (pivx,pivy) in
    layer coords. css_angle follows CSS rotate() (clockwise positive).
    Flips mirror local space first, matching CSS `rotate(r) scale(-1)`."""
    if flip_h:
        layer = layer.transpose(Image.FLIP_LEFT_RIGHT)
    if flip_v:
        layer = layer.transpose(Image.FLIP_TOP_BOTTOM)
    if css_angle:
        # rotate(-a) matches CSS rotate(a) (verified empirically); the pivot
        # follows PIL's pixel mapping rx = cos*dx + sin*dy,
        # ry = -sin*dx + cos*dy.
        th = math.radians(-css_angle)
        r = layer.rotate(-css_angle, resample=Image.BICUBIC, expand=True)
        cx, cy = layer.size[0] / 2.0, layer.size[1] / 2.0
        ncx, ncy = r.size[0] / 2.0, r.size[1] / 2.0
        dx, dy = pivx - cx, pivy - cy
        rx = dx * math.cos(th) + dy * math.sin(th)
        ry = -dx * math.sin(th) + dy * math.cos(th)
        ox = ox + pivx - (ncx + rx)
        oy = oy + pivy - (ncy + ry)
        layer = r
    composite_at(base, layer, ox, oy)


def measure_line(font, text, tracking=0):
    d = ImageDraw.Draw(Image.new("RGBA", (8, 8), (0, 0, 0, 0)))
    if not tracking:
        bb = d.textbbox((0, 0), text, font=font)
        return bb[2] - bb[0]
    total = 0
    for ch in text:
        bb = d.textbbox((0, 0), ch, font=font)
        total += bb[2] - bb[0]
    return total + tracking * max(0, len(text) - 1)


def render_caption(fonts, slide, rect, cW, cH, theme, inverted, locale, headline_font, label_font):
    """Caption layer. Like the browser (overflow:visible), text is NOT clipped
    to the rect: the layer grows to fit long lines, anchored at the rect's
    top edge and centered on its x-center (flex-start container)."""
    unit = min(cW, cH)
    fg = theme["fgAlt"] if inverted else theme["fg"]
    ls = slide.get("labelStyle") or {}
    hs = slide.get("headlineStyle") or {}
    label_size = ls.get("fontSize") or unit * 0.028
    label_weight = ls.get("fontWeight") or 600
    label_family = ls.get("fontFamily") or label_font
    label_color = ls.get("color") or theme["accent"]
    head_size = hs.get("fontSize") or unit * 0.092
    head_weight = hs.get("fontWeight") or 700
    head_family = hs.get("fontFamily") or headline_font
    head_color = hs.get("color") or fg
    label = pick_text(slide.get("label"), locale)
    headline = pick_text(slide.get("headline"), locale)
    fl = fonts.font(label_family, label_size, label_weight) if label else None
    fh = fonts.font(head_family, head_size, head_weight) if headline else None
    need_w = int(round(rect["w"]))
    need_h = 0.0
    if label:
        need_w = max(need_w, int(measure_line(fl, label.upper(), unit * 0.0015)) + 40)
        asc, desc = fl.getmetrics()
        need_h += asc + desc + unit * 0.018
    head_lines = headline.split("\n") if headline else []
    if head_lines:
        need_w = max(need_w, max([measure_line(fh, ln) for ln in head_lines if ln] or [0]) + 40)
        need_h += head_size * 1.2 * len(head_lines)
    w = max(1, int(round(max(rect["w"], need_w))))
    h = max(1, int(round(max(rect["h"], need_h + 20))))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = 10.0
    if label and fl is not None:
        y = draw_tracked_text(layer, w / 2.0, y, label.upper(), fl, label_color, unit * 0.0015)
        y += unit * 0.018
    if head_lines and fh is not None:
        draw_centered_block(layer, w / 2.0, y, head_lines, fh, head_color, head_size * 1.2)
    # anchor: top edge at rect top, horizontally centered on rect center
    return layer, (rect["x"] + rect["w"] / 2 - w / 2, rect["y"] - 10)


def render_text_element(fonts, el, cW, cH, theme, inverted, locale, label_font):
    """Overlay text layer. Browser centers content in the rect with visible
    overflow, so the layer grows beyond small rects instead of clipping."""
    unit = min(cW, cH)
    t = el.get("transform") or {}
    rw = t.get("width", 100)
    rh = t.get("height", 40)
    size = el.get("fontSize") or unit * 0.06
    weight = el.get("fontWeight") or 700
    family = el.get("fontFamily") or label_font
    color = el.get("color") or (theme["fgAlt"] if inverted else theme["fg"])
    f = fonts.font(family, size, weight)
    lines = pick_text(el.get("text"), locale).split("\n")
    lh = size * 1.05
    need_w = max([measure_line(f, ln) for ln in lines if ln] or [0]) + 40
    need_h = lh * len(lines) + 20
    w = max(1, int(round(max(rw, need_w))))
    h = max(1, int(round(max(rh, need_h))))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_centered_block(layer, w / 2.0, (h - lh * len(lines)) / 2.0, lines, f, color, lh)
    # anchor: centered on the rect center (flex center container)
    cx = t.get("x", 0) + rw / 2
    cy = t.get("y", 0) + rh / 2
    return layer, (cx - w / 2, cy - h / 2)


# ---------- device frames (port of device-frames.tsx) ----------

def rounded_mask(w, h, rx, ry=None):
    ry = rx if ry is None else ry
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=int(round(min(rx, ry))), fill=255)
    return m


CHASSIS_STOPS = {
    # (edge light, quarter, deep, toe) bands of the 150deg chassis gradient
    "titanium": ((74, 74, 82), (43, 43, 48), (20, 20, 24), (46, 46, 52)),
    "black": ((30, 30, 35), (14, 14, 18), (0, 0, 0), (24, 24, 29)),
    "white": ((242, 242, 245), (207, 207, 214), (169, 169, 178), (227, 227, 233)),
}


def chassis_gradient(w, h, finish="titanium"):
    light, quarter, deep, toe = CHASSIS_STOPS.get(finish, CHASSIS_STOPS["titanium"])
    sw = max(2, w // 4)
    img = Image.new("RGB", (1, 64))
    px = img.load()
    for y in range(64):
        k = y / 63.0
        if k < 0.25:
            t = k / 0.25
            c = tuple(int(light[i] + (quarter[i] - light[i]) * t) for i in range(3))
        elif k < 0.65:
            t = (k - 0.25) / 0.4
            c = tuple(int(quarter[i] + (deep[i] - quarter[i]) * t) for i in range(3))
        else:
            t = (k - 0.65) / 0.35
            c = tuple(int(deep[i] + (toe[i] - deep[i]) * t) for i in range(3))
        px[0, y] = c
    return img.resize((sw, h), Image.BILINEAR).resize((w, h), Image.BILINEAR)


def render_frame(device, rect_w, rect_h, screenshot_im, secondary=False, finish="titanium"):
    """Device frame (chassis + screen + island/camera) as RGBA layer.

    Desktop is always frameless (Mac App Store style); finish "none" renders
    phone/tablet edge-to-edge the same way. Empty frameless shots stay
    transparent (browser hideEmpty renders an empty div)."""
    w, h = max(8, int(round(rect_w))), max(8, int(round(rect_h)))
    if device == "desktop" or finish == "none":
        frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        if screenshot_im is not None:
            frame.alpha_composite(cover_fit(screenshot_im, w, h).convert("RGBA"))
        if secondary:
            a = frame.getchannel("A").point(lambda v: int(v * 0.85))
            frame.putalpha(a)
        return frame
    is_pad = device == "tablet"
    if is_pad:
        slot = (0.026, 0.02, 0.948, 0.96)
        outer_rx = (0.04 * w, 0.03 * h)
        slot_r = 0.016 * w
    else:
        slot = (0.024, 0.0115, 0.952, 0.977)
        outer_rx = (0.13 * w, 0.0625 * h)
        slot_r = 0.10 * w * 0.952
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    body = chassis_gradient(w, h, finish).convert("RGBA")
    body.putalpha(rounded_mask(w, h, *outer_rx))
    frame.alpha_composite(body)
    # inner highlight edge
    edge = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle([1, 1, w - 2, h - 2], radius=int(round(min(outer_rx))) - 1,
                                           outline=(255, 255, 255, 46), width=max(1, w // 400))
    frame.alpha_composite(edge)
    sx, sy, swf, shf = slot
    sx, sy, sw, sh = int(sx * w), int(sy * h), int(swf * w), int(shf * h)
    if screenshot_im is not None:
        screen = cover_fit(screenshot_im, sw, sh).convert("RGBA")
    else:
        # hideEmpty export: dark empty slot (no placeholder text baked in)
        screen = angled_gradient(sw, sh, "#1a1a1a", "#0a0a0a", 135).convert("RGBA")
    screen.putalpha(rounded_mask(sw, sh, slot_r))
    frame.alpha_composite(screen, (sx, sy))
    d = ImageDraw.Draw(frame)
    if not is_pad:
        # Dynamic Island: pill at top 1.6% of slot, 27.5% wide, 3.2% tall
        iw, ih = int(sw * 0.275), max(2, int(sh * 0.032))
        ix, iy = sx + (sw - iw) // 2, sy + int(sh * 0.016)
        d.rounded_rectangle([ix, iy, ix + iw, iy + ih], radius=ih // 2, fill=(0, 0, 0, 255))
    else:
        # front camera centered in the top bezel
        cw = max(2, int(w * 0.021))
        cx, cy = w // 2, int(h * 0.008)
        d.ellipse([cx - cw // 2, cy - cw // 2, cx + cw // 2, cy + cw // 2], fill=(12, 18, 30, 255))
    if secondary:
        # back-device dimming (browser renders secondary at opacity 0.85)
        a = frame.getchannel("A").point(lambda v: int(v * 0.85))
        frame.putalpha(a)
    return frame


# ---------- slide compositing ----------

def rect_for(saved_transforms, key, defaults):
    saved = (saved_transforms or {}).get(key)
    dflt = defaults.get(key)
    if not dflt and not saved:
        return None
    if not saved:
        return dict(dflt)
    r = {"x": saved["x"], "y": saved["y"], "w": saved["width"], "h": saved["height"]}
    if dflt and dflt.get("align"):
        r["align"] = dflt["align"]
    return r


def paint_slide(canvas, slide, ox, cW, cH, ctx, warnings, clip_to_screen):
    """Paint one screen at strip offset ox. Elements keep DOM z-order:
    secondary < device < caption < overlay texts."""
    device = ctx["device"]
    theme = ctx["theme"]
    locale = ctx["locale"]
    fonts = ctx["fonts"]
    workspace = ctx["workspace"]
    inverted = bool(slide.get("inverted"))
    layout = slide.get("layout", "device-bottom")
    if device == "tablet":
        aspect = IPAD_MK_RATIO
        fw = frame_width_frac(cW, cH, 0.8, aspect)
        fws = frame_width_frac(cW, cH, 0.62, aspect)
    elif device == "desktop":
        aspect = DESKTOP_RATIO
        fw = frame_width_frac(cW, cH, 0.9, aspect)
        fws = frame_width_frac(cW, cH, 0.7, aspect)
    else:
        aspect = MK_RATIO
        fw = frame_width_frac(cW, cH, 0.84, aspect)
        fws = frame_width_frac(cW, cH, 0.66, aspect)
    finish = (ctx.get("frames") or {}).get(device, "titanium")
    defaults = default_rects(layout, cW, cH, aspect, fw, fws)
    transforms = slide.get("transforms") or {}

    screen = Image.new("RGBA", (cW, cH), (0, 0, 0, 0))
    bg_kind = (slide.get("background") or {}).get("kind")
    proj_bg = ctx["project_background"]
    bg = slide.get("background") if bg_kind else proj_bg
    screen.alpha_composite(render_background(cW, cH, bg, None, theme, inverted, workspace, locale, warnings))

    if layout == "static":
        p = resolve_upload(workspace, slide.get("screenshot", ""), locale)
        im = load_image(p) if p else None
        if im is not None:
            screen.alpha_composite(cover_fit(im, cW, cH).convert("RGBA"))
        elif slide.get("screenshot"):
            warnings.append("screenshot missing: %s" % slide.get("screenshot"))
        for el in slide.get("textElements") or []:
            t = el.get("transform") or {}
            layer, (ax, ay) = render_text_element(fonts, el, cW, cH, theme, inverted, locale, ctx["label_font"])
            cx = t.get("x", 0) + t.get("width", 0) / 2
            cy = t.get("y", 0) + t.get("height", 0) / 2
            paste_about(screen, layer, ax, ay, cx - ax, cy - ay, t.get("rotation") or 0,
                        t.get("flipH") or False, t.get("flipV") or False)
    else:
        shots = {
            "device": resolve_upload(workspace, slide.get("screenshot", ""), locale),
            "deviceSecondary": resolve_upload(workspace, slide.get("screenshotSecondary") or slide.get("screenshot", ""), locale),
        }
        if layout != "no-device" and slide.get("screenshot") and not shots["device"]:
            warnings.append("screenshot missing: %s" % slide.get("screenshot"))
        for key in ("deviceSecondary", "device"):
            rect = rect_for(transforms, key, defaults)
            if not rect:
                continue
            saved = transforms.get(key) or {}
            im = load_image(shots[key]) if shots[key] else None
            layer = render_frame(device, rect["w"], rect["h"], im,
                                 secondary=(key == "deviceSecondary"), finish=finish)
            paste_rotated(screen, layer, rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2,
                          saved.get("rotation") or 0,
                          saved.get("flipH") or False, saved.get("flipV") or False)
        rect = rect_for(transforms, "caption", defaults)
        if rect:
            saved = transforms.get("caption") or {}
            layer, (ax, ay) = render_caption(fonts, slide, rect, cW, cH, theme, inverted, locale,
                                             ctx["headline_font"], ctx["label_font"])
            cx = rect["x"] + rect["w"] / 2
            cy = rect["y"] + rect["h"] / 2
            paste_about(screen, layer, ax, ay, cx - ax, cy - ay, saved.get("rotation") or 0,
                        saved.get("flipH") or False, saved.get("flipV") or False)
        for el in slide.get("textElements") or []:
            t = el.get("transform") or {}
            layer, (ax, ay) = render_text_element(fonts, el, cW, cH, theme, inverted, locale, ctx["label_font"])
            cx = t.get("x", 0) + t.get("width", 0) / 2
            cy = t.get("y", 0) + t.get("height", 0) / 2
            paste_about(screen, layer, ax, ay, cx - ax, cy - ay, t.get("rotation") or 0,
                        t.get("flipH") or False, t.get("flipV") or False)

    # Isolated canvases are exactly one screen wide, so canvas bounds clip
    # overflow automatically (each screen clips its own elements, like the
    # browser isolated export). Connected strips are N screens wide, so
    # overflow lands on neighboring screens and splits on crop, like the
    # browser connected export.
    canvas.alpha_composite(screen, (ox, 0))
    return canvas


# ---------- job runner ----------

def collect_fonts(job):
    """(family, weight) pairs needed, mirroring ensureFontsLoaded scope."""
    out = set()
    proj = job["project"]
    out.add((proj.get("headlineFont") or "Nunito", 700))
    out.add((proj.get("labelFont") or "Inter", 600))
    for u in job["units"]:
        s = u["slide"]
        for key, default_w in (("labelStyle", 600), ("headlineStyle", 700)):
            st = s.get(key) or {}
            if st.get("fontFamily"):
                out.add((st["fontFamily"], st.get("fontWeight") or default_w))
        for el in s.get("textElements") or []:
            if el.get("fontFamily"):
                out.add((el["fontFamily"], el.get("fontWeight") or 700))
    return sorted(out)


def run_job(job_path):
    with open(job_path, "r", encoding="utf-8") as f:
        job = json.load(f)
    if not HAVE_PIL:
        return {"ok": False, "error": "Python Pillow (PIL) is not installed; headless rendering needs it"}
    workspace = job["workspace"]
    proj = job["project"]
    cW, cH = proj["canvas"]["w"], proj["canvas"]["h"]
    device = {"iphone": "phone", "ipad": "tablet"}.get(proj.get("device", "phone"), proj.get("device", "phone"))
    if device not in ("phone", "tablet", "desktop"):
        device = "phone"
    connected = bool(job.get("connected"))
    out_dir = job["outDir"]
    files_dir = os.path.join(out_dir, "files")
    os.makedirs(files_dir, exist_ok=True)
    fonts = Fonts(job.get("fontCache") or os.path.join(tempfile.gettempdir(), "storeshot-mcp-fonts"))
    warnings = []
    for family, weight in collect_fonts(job):
        try:
            fonts.font(family, 32, weight)
        except Exception as e:
            warnings.append("font unavailable, system fallback: %s (%s)" % (family, e))
    for family, weight in sorted(fonts.fell_back):
        warnings.append("font download failed, system fallback in output: %s %d" % (family, weight))

    # group units by locale: one strip per locale
    by_locale = {}
    for u in job["units"]:
        by_locale.setdefault(u["locale"], []).append(u)

    ctx_base = {
        "device": device,
        "theme": proj["theme"],
        "fonts": fonts,
        "workspace": workspace,
        "project_background": proj.get("background") or {"kind": "theme"},
        "headline_font": proj.get("headlineFont") or "Nunito",
        "label_font": proj.get("labelFont") or "Inter",
        "frames": proj.get("frames") or {},
    }
    done, missing = [], []
    for locale, units in by_locale.items():
        try:
            ctx = dict(ctx_base, locale=locale)
            strip = Image.new("RGBA", (cW * len(units), cH), (0, 0, 0, 0))
            for i, u in enumerate(units):
                paint_slide(strip, u["slide"], i * cW, cW, cH, ctx, warnings,
                            clip_to_screen=not connected)
            for i, u in enumerate(units):
                try:
                    crop = strip.crop((i * cW, 0, (i + 1) * cW, cH))
                    tw, th = int(u["target"]["w"]), int(u["target"]["h"])
                    if (tw, th) != (cW, cH):
                        crop = crop.resize((tw, th), Image.LANCZOS)
                    flat = Image.new("RGB", crop.size, (255, 255, 255))
                    flat.paste(crop, mask=crop.getchannel("A"))
                    name = "u%d.png" % (len(done) + len(missing))
                    fpath = os.path.join(files_dir, name)
                    flat.save(fpath, "PNG")
                    done.append({"zipPath": u["zipPath"], "file": fpath,
                                 "w": tw, "h": th, "slideId": u["slide"].get("id")})
                except Exception:
                    err("unit failed %s:\n%s" % (u.get("zipPath"), traceback.format_exc()))
                    missing.append(u.get("zipPath"))
        except Exception:
            err("locale strip failed %s:\n%s" % (locale, traceback.format_exc()))
            for u in units:
                missing.append(u.get("zipPath"))

    zip_path = os.path.join(out_dir, job.get("zipName", "storeshot-export.zip"))
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for d in done:
                zf.write(d["file"], d["zipPath"])
    except Exception as e:
        return {"ok": False, "error": "zip failed: %s" % e, "warnings": warnings}

    return {"ok": True, "zip": zip_path, "units": done, "missing": missing,
            "warnings": sorted(set(warnings)),
            "partial": len(missing) > 0}


def main():
    if len(sys.argv) != 2:
        sys.stderr.write("usage: render.py <job.json>\n")
        return 2
    try:
        manifest = run_job(sys.argv[1])
    except Exception:
        err("fatal:\n%s" % traceback.format_exc())
        manifest = {"ok": False, "error": "renderer crashed (see stderr)"}
    sys.stdout.write(json.dumps(manifest))
    sys.stdout.write("\n")
    return 0 if manifest.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
