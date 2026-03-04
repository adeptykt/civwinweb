from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

x_start = 1 * 323 + 195
y_start = 1 * 204

# Print a tiny map of Lincoln
for y in range(y_start + 40, y_start+60, 2):
    row = ""
    for x in range(x_start + 40, x_start + 90, 2):
        c = img.getpixel((x, y))
        if c == (0, 0, 0): row += "X"
        elif c == (0, 0, 155): row += "B"
        else: row += "."
    print(row)
