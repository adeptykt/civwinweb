from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Let's map out the actual 3x5 grid using the 181 start!
for r in range(5):
   for c in range(3):
      if r == 4 and c == 2: break
      x_start = 181 + (c * 325)
      y_start = 1 + (r * 205)
      print(f"[{c},{r}] Portrait assumed bounds: {x_start} (width 144), y={y_start}")

