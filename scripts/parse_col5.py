from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# It's a grid of 59px wide boxes.
# A portrait is clearly bigger than 59px! Let's scan y=450 again (middle of the portrait logic normally).
print("Row 450 checking larger gap")
for x in range(300, 700):
   if img.getpixel((x, 450)) != (255, 67, 255) and img.getpixel((x-1, 450)) == (255, 67, 255):
       end = x
       for i in range(x, 700):
           if img.getpixel((i, 450)) == (255, 67, 255):
               end = i - 1
               break
       print(f"Start: {x}, End: {end}, Width: {end - x + 1}")

