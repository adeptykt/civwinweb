from PIL import Image
img = Image.open('src/assets/leaders.png').convert('RGB')
# French = col 2, row 3
bx, by = 650, 615
portOffsetX, portW, portH = 181, 144, 204
px = bx + portOffsetX + 1  # 832
py = by + 1                 # 616

print(f"French/Napoleon portrait area: ({px},{py}) to ({px+portW-3},{py+portH-3})")
print()

seeds = [
  ("top-left",    px,             py),
  ("top-right",   px + portW - 3, py),
  ("bot-left",    px,             py + portH - 3),
  ("bot-right",   px + portW - 3, py + portH - 3),
  ("top-centre",  px + portW//2,  py),
]
for name, x, y in seeds:
    print(f"  {name:12s} ({x},{y}) = {img.getpixel((x,y))}")

print("\nSampling top edge of portrait (y=py):")
for x in range(px, px+portW, 8):
    print(f"  x={x}: {img.getpixel((x,py))}")

print("\nSampling left edge (x=px):")
for y in range(py, py+portH, 16):
    print(f"  y={y}: {img.getpixel((px,y))}")

print("\nSampling right edge (x=px+portW-3):")
for y in range(py, py+portH, 16):
    print(f"  y={y}: {img.getpixel((px+portW-3,y))}")
