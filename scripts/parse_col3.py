from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

print("We have the pattern now!!")
print("Every mood face grid slot is exactly 59px wide! And the portrait might be built differently.")
# We are currently parsing a 59x59 grid or something similar?
# Let's count the 59 spans.
print("Row 411 Non-magenta spans:")
for x in range(300, 700):
   if img.getpixel((x, 411)) != (255, 67, 255) and img.getpixel((x-1, 411)) == (255, 67, 255):
       end = x
       for i in range(x, 700):
           if img.getpixel((i, 411)) == (255, 67, 255):
               end = i - 1
               break
       print(f"Start: {x}, End: {end}, Width: {end - x + 1}")
