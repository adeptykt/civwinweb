from PIL import Image
img = Image.open('src/assets/leaders.png').convert('RGB')
def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255

print("Hammurabi Block at y=450")
for x in range(400, 600):
   if not is_m(img.getpixel((x, 450))):
       print(x, "Not magenta")
       break
