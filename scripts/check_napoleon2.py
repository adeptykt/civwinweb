from PIL import Image
img = Image.open('src/assets/leaders.png').convert('RGB')
w, h = img.size
print(f"Image size: {w}x{h}")

# French = col 2, row 3
bx, by = 650, 615
portOffsetX, portW, portH = 181, 144, 204
px = bx + portOffsetX + 1  # 832
py = by + 1                 # 616

# Clamp to image bounds
def safe_pixel(x, y):
    x = min(x, w-1)
    y = min(y, h-1)
    return img.getpixel((x, y))

print(f"\nPortrait x range: {px} to {min(px+portW-1, w-1)}")

seeds = [
  ("top-left",    px,                      py),
  ("top-right",   min(px + portW - 3, w-1), py),
  ("bot-left",    px,                      min(py + portH - 3, h-1)),
  ("bot-right",   min(px + portW - 3, w-1), min(py + portH - 3, h-1)),
  ("top-centre",  px + portW//2,            py),
]
for name, x, y in seeds:
    print(f"  {name:12s} ({x},{y}) = {safe_pixel(x,y)}")

# Find all unique colors in the portrait background area 
# (sample a grid)
print("\nUnique colors sampled across Napoleon's portrait (every 4px):")
colors = set()
for y in range(py, min(py+portH, h), 4):
    for x in range(px, min(px+portW, w), 4):
        colors.add(img.getpixel((x, y)))

# Sort by frequency
from collections import Counter
color_counter = Counter()
for y in range(py, min(py+portH, h)):
    for x in range(px, min(px+portW, w)):
        color_counter[img.getpixel((x, y))] += 1

print("Top 15 most common colors in portrait area:")
for color, count in color_counter.most_common(15):
    print(f"  {color}: {count} pixels")
