from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

# American is col=1, row=1
x_start = 1 * 323 + 195
y_start = 1 * 204

print(f"Lincoln BG at ({x_start}, {y_start}): {img.getpixel((x_start, y_start))}")
print(f"Lincoln BG at ({x_start+5}, {y_start+5}): {img.getpixel((x_start+5, y_start+5))}")

# Check inner hair/eyes colors for lincoln specifically
# Just take some pixels near the center
print(f"Lincoln face sample 1: {img.getpixel((x_start + 65, y_start + 60))}")
print(f"Lincoln face sample 2: {img.getpixel((x_start + 60, y_start + 70))}")
