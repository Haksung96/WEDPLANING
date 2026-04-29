# Quick icon generator. Run: python generate-icons.py
# Generates 192x192 and 512x512 PNG icons with the wedding ring emoji on a gradient.

from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size, out_path):
    img = Image.new('RGB', (size, size), '#1a1a2e')
    draw = ImageDraw.Draw(img)

    # Gradient background
    for y in range(size):
        ratio = y / size
        r = int(0x1a + (0x2d - 0x1a) * ratio)
        g = int(0x1a + (0x1b - 0x1a) * ratio)
        b = int(0x2e + (0x3d - 0x2e) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # Pink heart circle in center
    cx, cy = size // 2, size // 2
    radius = int(size * 0.32)
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill='#ff6b9d')

    # White heart symbol
    try:
        font = ImageFont.truetype('arial.ttf', int(size * 0.45))
    except Exception:
        font = ImageFont.load_default()
    text = '♡'
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - w / 2 - bbox[0], cy - h / 2 - bbox[1] - int(size * 0.02)), text, fill='white', font=font)

    img.save(out_path, 'PNG')
    print(f'Wrote {out_path}')

if __name__ == '__main__':
    here = os.path.dirname(__file__)
    make_icon(192, os.path.join(here, 'icon-192.png'))
    make_icon(512, os.path.join(here, 'icon-512.png'))
