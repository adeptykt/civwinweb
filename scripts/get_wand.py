from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

x = 1 * 323
y = 2 * 204
w = 323
h = 204

bg_blue = (0, 0, 155)
bg_cyan = (0, 187, 255)
magenta = (255, 67, 255)
black = (0, 0, 0)
grey_bg_1 = (103, 119, 163) 

mood_faces_max_x = 0
for j in range(y, y + h):
    for i in range(x, x + int(w * 0.4)): 
        r,g,b = img.getpixel((i, j))
        if (r,g,b) not in [bg_blue, bg_cyan, magenta, black, grey_bg_1, (0,0,0)]:
            if i - x > mood_faces_max_x:
                mood_faces_max_x = i - x

print(f"Mood faces extend up to col: {mood_faces_max_x}")

portrait_min_x = w
for j in range(y, y + h):
    for i in range(x + mood_faces_max_x + 5, x + w): 
        r,g,b = img.getpixel((i, j))
        if (r,g,b) not in [bg_blue, bg_cyan, magenta, black, grey_bg_1, (0,0,0)]:
            if i - x < portrait_min_x:
                portrait_min_x = i - x

print(f"Portrait starts at col: {portrait_min_x}")
