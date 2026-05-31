from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Find exact horizontal spans at key y positions for row 2 (Hammurabi)
row2_y_start = 411

for test_y in [row2_y_start, row2_y_start + 50, row2_y_start + 100, row2_y_start + 150]:
    spans = []
    s = -1
    for x in range(0, img.width):
        if not is_m(img.getpixel((x, test_y))):
            if s == -1: s = x
        elif s != -1:
            spans.append((s, x-1, x-s))
            s = -1
    if s != -1: spans.append((s, img.width-1, img.width-s))
    print(f"y={test_y}: {spans}")
