from PIL import Image
def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')
cols = []
s = -1
for x in range(img.width):
 if not is_m(img.getpixel((x, 10))):
  if s==-1: s=x
 elif s!=-1:
  cols.append((s, x-1))
  s=-1
if s!=-1: cols.append((s, img.width-1))
print("Cols:", cols)
