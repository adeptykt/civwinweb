from PIL import Image

img = Image.open('src/assets/leaders.png').convert('RGB')
w, h = img.size
print(w, h)

def is_magenta(c):
    return c[0] == 255 and c[1] == 67 and c[2] == 255

def analyze_sheet():
    # Find all solid magenta columns
    magenta_cols = []
    for x in range(w):
        all_magenta = True
        for y in range(h):
            if not is_magenta(img.getpixel((x, y))):
                all_magenta = False
                break
        if all_magenta:
            magenta_cols.append(x)
            
    print("Magenta cols:", magenta_cols)
    
    magenta_rows = []
    for y in range(h):
        all_magenta = True
        for x in range(w):
            if not is_magenta(img.getpixel((x, y))):
                all_magenta = False
                break
        if all_magenta:
            magenta_rows.append(y)
            
    print("Magenta rows:", magenta_rows)

analyze_sheet()

