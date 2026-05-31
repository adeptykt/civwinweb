from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

for r in range(5):
    for c in range(3):
        x = c * 323 + 195
        y = r * 204 + 2
        if x < img.width and y < img.height:
            print(f"Row {r} Col {c} bg: {img.getpixel((x, y))}")

