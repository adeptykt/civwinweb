from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

y = 450
print(f"Row at {y}, x from 300 to 700:")

# What is at 450??
# 326 to 624 is width 299.
# This means there's a massive span of non-magenta in the middle!
for x in range(326, 624):
    c = img.getpixel((x, y))
    # just look for an internal border between mood faces and portrait.
    if c[0] == c[1] == c[2] and c[2] < 20: # black or dark?
        pass

# let's look at y=411 (very top of row 2)
print("Looking at row top")
start = -1
for x in range(300, 700):
   if not is_m(img.getpixel((x, 411))):
      if start == -1: start = x
   elif start != -1:
      print(f"Row 411 Non-magenta span: {start} to {x-1}, width={x-start}")
      start = -1

