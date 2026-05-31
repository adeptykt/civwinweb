from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Find the exact row height for each of the 5 rows. Row N is non-magenta from y=A to y=B
rows_y = []
s = -1
for y in range(img.height):
    # Check if this row contains non-magenta pixels
    has_non_m = False
    for x in range(0, img.width, 10):  # sample every 10th pixel for speed
        if not is_m(img.getpixel((x, y))):
            has_non_m = True
            break
    if has_non_m and s == -1:
        s = y
    elif not has_non_m and s != -1:
        rows_y.append((s, y-1, y-s))
        s = -1
if s != -1: rows_y.append((s, img.height-1, img.height-s))
print("Row spans:", rows_y)

# Similarly for columns
cols_x = []
s = -1
for x in range(img.width):
    has_non_m = False
    for y in range(0, img.height, 10):
        if not is_m(img.getpixel((x, y))):
            has_non_m = True
            break
    if has_non_m and s == -1:
        s = x
    elif not has_non_m and s != -1:
        cols_x.append((s, x-1, x-s))
        s = -1
if s != -1: cols_x.append((s, img.width-1, img.width-s))
print("Col spans:", cols_x)
