from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

y = 450
print(f"Row at {y}, x from 300 to 700:")
start = -1
for x in range(300, 700):
    if not is_m(img.getpixel((x, y))):
        if start == -1:
            start = x
    elif start != -1:
        print(f"Non-magenta span: {start} to {x-1}, width={x-start}")
        start = -1
if start != -1:
    print(f"Non-magenta span: {start} to 699, width={700-start}")

