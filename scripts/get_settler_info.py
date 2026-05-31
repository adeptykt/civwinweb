from PIL import Image

def main():
    try:
        img = Image.open('src/assets/settler.png').convert('RGBA')
        print(f"Size: {img.size}")
        print(f"Bounding Box: {img.getbbox()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
