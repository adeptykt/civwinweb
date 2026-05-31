from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Block 0,0: English leader
# Scan different y values to understand the face vs portrait layout
print("Block 0,0 layout at different y values (portrait appears to occupy right half starting at x=181):")
for test_y in [10, 30, 50, 55, 60, 100, 150, 204]:
    spans = []
    s = -1
    for x in range(0, 330):
        if not is_m(img.getpixel((x, test_y))):
            if s == -1: s = x
        elif s != -1:
            spans.append((s, x-1))
            s = -1
    if s != -1: spans.append((s, 329))
    print(f"  y={test_y}: {spans}")
