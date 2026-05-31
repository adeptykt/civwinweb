from PIL import Image

def is_m(c): return c[0]==255 and c[1]==67 and c[2]==255
img = Image.open('src/assets/leaders.png').convert('RGB')

# Face cell sizes: width=59, gap=1. 
# At y=411 (top of row 2), the spans were:
# (326, 384, 59), (386, 444, 59), (446, 504, 59), (506, 564, 59), (566, 624, 59)
# These are 5 * 59px spans.
# But the first span at the top row is: 301->324 which is width 24

# For face cells, at y=411 each face cell starts at: 326, 386, 446, (fourth?)
# Actually the FIRST block (col=0) starts at 1:
# Row 411: (1, 59, 59), (61, 119, 59), (121, 179, 59), (181, 239, 59), (241, 299, 59)
# But at y=461 it's: (1, 59, 59), (61, 119, 59), (121, 179, 59), (181, 324, 144)
# So below the top 50px (faces area), portrait spans 181-324 (144 wide)

print("At y=431 (near face section bottom):")
spans = []
s = -1
for x in range(img.width):
    if not is_m(img.getpixel((x, 431))):
        if s == -1: s = x
    elif s != -1:
        spans.append((s, x-1, x-s))
        s = -1
if s != -1: spans.append((s, img.width-1, img.width-s))
print(spans)
