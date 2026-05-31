from PIL import Image

img = Image.open('src/assets/leaders.png').convert('RGB')

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

row_starts = [0, 205, 410, 615, 820]
col_starts = [0, 325, 650]

for x in range(325):
    for y in range(205):
        if is_magenta(img.getpixel((x, y))):
            print(f"Magenta inside first block at x={x}, y={y}")
            break

