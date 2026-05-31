from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Instead of blindly guessing, let's find the widest continuous non-magenta region in col 0.
max_w = 0
best_x = -1

for y in range(200):
   s = -1
   for x in range(325):
      if not is_m(img.getpixel((x, y))):
         if s == -1: s = x
      elif s != -1:
         w = x - s
         if w > max_w:
            max_w = w
            best_x = s
         s = -1
   if s != -1:
       w = 325 - s
       if w > max_w:
           max_w = w
           best_x = s

print(f"Widest non-magenta thing in block 0: starts at {best_x} and is {max_w} pixels wide.")
