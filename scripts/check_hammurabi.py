from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

# Hammurabi is col=1, row=2
# So x_start = 1 * 323 = 323
# y_start = 2 * 204 = 408
x_start = 1 * 323 + 195
y_start = 2 * 204

print(f"Hammurabi BG at top corner ({x_start}, {y_start}): {img.getpixel((x_start, y_start))}")
print(f"Hammurabi BG at right corner ({x_start+120}, {y_start}): {img.getpixel((x_start+120, y_start))}")

