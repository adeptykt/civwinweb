from PIL import Image

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

def run():
    img = Image.open('src/assets/leaders.png').convert('RGB')
    
    xs = []
    for x in range(img.width):
        curr = img.getpixel((x, 100))
        prev = img.getpixel((x-1, 100)) if x > 0 else (255, 67, 255)
        if not is_magenta(curr) and is_magenta(prev):
            xs.append(x)
    print("Col starts:", xs)
    
    ys = []
    for y in range(img.height):
        curr = img.getpixel((100, y))
        prev = img.getpixel((100, y-1)) if y > 0 else (255, 67, 255)
        if not is_magenta(curr) and is_magenta(prev):
            ys.append(y)
    print("Row starts:", ys)

run()
