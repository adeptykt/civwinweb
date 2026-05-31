from PIL import Image

img = Image.open('src/assets/leaders.png')
img = img.convert('RGB')

def test_bg_at(x, y):
    print(f"Color at {x},{y}: {img.getpixel((x, y))}")

test_bg_at(323 + 195, 2)  # Cleopatra bg top-left
test_bg_at(323 + 195, 200) # Cleopatra bg bot-left
test_bg_at(5, 5) # English
