from PIL import Image
import sys

try:
    img = Image.open('src/assets/v3units/settler.png')
    img = img.convert("RGBA")
    data = img.getdata()
    alpha_counts = {}
    for pixel in data:
        a = pixel[3]
        alpha_counts[a] = alpha_counts.get(a, 0) + 1
    print("Alpha value counts:", alpha_counts)
except Exception as e:
    print(e)
