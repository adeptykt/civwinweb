from PIL import Image

# What about the mood faces? did I just cut them off by changing `PORTRAIT_X`? Yes!!
# PORTRAIT_X was originally 194. It was used as the width of the mood faces area.
# By changing it to 129, I am squishing the mood face width to 129, making FACE_W = 129/4 = 32!
# This breaks the mood faces. They will be clipped!

# We need to change the CSS for the large portrait explicitly for Hammurabi but ideally just let PORTRAIT_X be the START of the portrait area, but now the mood faces are bounded differently. Actually, the left side has mood faces roughly taking up the whole 0 to 194 area!

img = Image.open('src/assets/leaders.png')
# Let's see if mood faces take up the space between 129 and 194.
x = 0
y = 0 # English
colors = set()
for j in range(y, y+51):
    for i in range(x+129, x+190):
        px = img.getpixel((i, j))
        if px[:3] not in [(0,0,155), (0,0,0), (255,67,255)]:
            colors.add(px[:3])
print(len(colors) > 0)
