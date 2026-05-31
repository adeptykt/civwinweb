from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

# American is col=1, row=1
x_start = 1 * 323 + 195
y_start = 1 * 204

print(f"Lincoln BG at 0,0 relative: {img.getpixel((x_start, y_start))}")
print(f"Lincoln BG at right relative: {img.getpixel((x_start+120, y_start))}")

