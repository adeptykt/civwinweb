from PIL import Image

def do_img(fname):
    img = Image.open(fname).convert("RGBA")
    data = img.getdata()
    alpha_counts = {}
    for pixel in data:
        a = pixel[3]
        alpha_counts[a] = alpha_counts.get(a, 0) + 1
    print(fname, "alpha:", alpha_counts)

do_img('src/assets/v3units/militia.png')
do_img('src/assets/v3units/phalanx.png')
