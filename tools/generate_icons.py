from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = root / 'logo.png'
out = root / 'icons'
out.mkdir(exist_ok=True)

sizes = [192, 512]
img = Image.open(src).convert('RGBA')
for s in sizes:
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    # fit logo into square while keeping aspect
    ratio = min(s / img.width, s / img.height)
    new_size = (int(img.width * ratio), int(img.height * ratio))
    resized = img.resize(new_size, Image.LANCZOS)
    pos = ((s - new_size[0]) // 2, (s - new_size[1]) // 2)
    canvas.paste(resized, pos, resized)
    canvas.save(out / f'icon-{s}.png', format='PNG')

print('Icons generated in', out)
