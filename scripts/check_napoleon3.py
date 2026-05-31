from PIL import Image
img = Image.open('src/assets/leaders.png').convert('RGB')
w, h = img.size

# French = col 2, row 3
bx, by = 650, 615
portOffsetX, portW, portH = 181, 144, 204
px = bx + portOffsetX + 1
py = by + 1

# Find the dominant background color and which shades it transitions through.
# Sample the extreme left column and the extreme right column of portrait
# (most likely to have background, not character, at the edges).
print("Left edge column (x=px) colors by row:")
for y in range(py, min(py+portH, h), 8):
    print(f"  y={y}: {img.getpixel((min(px,w-1), y))}")

print("\nRight edge column (x=px+portW-2) colors by row:")
for y in range(py, min(py+portH, h), 8):
    print(f"  y={y}: {img.getpixel((min(px+portW-2,w-1), y))}")

# Identify background colors by sampling just the top-left 20x20 corner
# of the portrait (most likely to be pure background)
print("\nTop 10 rows x left 30 cols (likely pure background):")
bg_colors = set()
for y in range(py, min(py+10, h)):
    for x in range(px, min(px+30, w)):
        bg_colors.add(img.getpixel((x, y)))
print(f"  Unique colors: {sorted(bg_colors)}")

print("\nAre there any pure-background columns/rows (check col x=px+2..px+5)?")
for x in range(px, min(px+6, w)):
    col_colors = set(img.getpixel((x, y)) for y in range(py, min(py+portH, h)))
    print(f"  col x={x}: {sorted(col_colors)[:8]}")
