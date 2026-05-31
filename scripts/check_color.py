from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

# Egyptian is col=1, row=0 -> target region x = 323 + 194 = 517, y = 0
colors = set()
for x in range(517, 517 + 20):
    for y in range(0, 20):
        colors.add(img.getpixel((x, y)))

print("Top left corner colors:", colors)

