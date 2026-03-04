from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

for r in range(5):
    for c in range(3):
        x = c * 323 + 195
        y = r * 204 + 2
        bg = img.getpixel((x, y))
        print(f"Row {r} Col {c} ({x},{y}) bg: {bg}")
        # Search for (0, 0, 155) in this large portrait
        found = False
        for px in range(c * 323 + 194, (c+1) * 323):
            for py in range(r * 204, (r+1) * 204):
                if px < img.width and py < img.height:
                    if img.getpixel((px, py)) == (0, 0, 155):
                        found = True
        print(f"  Contains (0, 0, 155)?: {found}")

