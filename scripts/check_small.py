from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

for r in range(5):
    for c in range(3):
        # top left of the entire block
        x = c * 323 + 2
        y = r * 204 + 2
        print(f"Row {r} Col {c} small bg: {img.getpixel((x, y))}")

