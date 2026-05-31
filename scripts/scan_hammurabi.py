from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

x = 1 * 323
y = 2 * 204
w = 323
h = 204

min_char_x = w
max_char_x = 0

for j in range(y, y + h):
    for i in range(x, x + w):
        r, g, b = img.getpixel((i, j))
        if r != 0 and g != 0 and b != 0:
            if i - x < min_char_x:
                min_char_x = i - x
            if i - x > max_char_x:
                max_char_x = i - x

print(f"Character pixels start at col {min_char_x} and end at {max_char_x}")
