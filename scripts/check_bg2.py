from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

def test_bg_at(x, y, name):
    print(f"{name} Color at {x},{y}: {img.getpixel((x, y))}")

test_bg_at(195, 2, "English")
test_bg_at(195, 200, "English bot")
test_bg_at(518, 2, "Egyptian")
test_bg_at(518+323, 2, "Indian")
