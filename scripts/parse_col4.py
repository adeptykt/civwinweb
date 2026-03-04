from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Wait... 326 to 624 are FIVE 59px wide blocks.
print("Row 616 (bottom mid):")
for x in range(300, 700):
   if img.getpixel((x, 616)) != (255, 67, 255) and img.getpixel((x-1, 616)) == (255, 67, 255):
       end = x
       for i in range(x, 700):
           if img.getpixel((i, 616)) == (255, 67, 255):
               end = i - 1
               break
       print(f"Start: {x}, End: {end}, Width: {end - x + 1}")
