from PIL import Image

img = Image.open('src/assets/civ1units.png').convert("RGBA")
block = img.crop((0, 320, 32, 352))

colors = {}
for y in range(32):
    for x in range(32):
        p = block.getpixel((x, y))
        colors[p] = colors.get(p, 0) + 1

for c, count in sorted(colors.items(), key=lambda item: item[1], reverse=True)[:10]:
    print(c, count)
