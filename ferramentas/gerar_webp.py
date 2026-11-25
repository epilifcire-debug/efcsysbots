"""Gera as versões leves (WebP, 240 px de largura) dos sprites para o app."""
import glob
import os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, "assets", "sprites")
DESTINO = os.path.join(RAIZ, "app", "sprites")
os.makedirs(DESTINO, exist_ok=True)

for caminho in sorted(glob.glob(os.path.join(ORIGEM, "*.png"))):
    im = Image.open(caminho)
    im = im.resize((240, round(im.height * 240 / im.width)), Image.LANCZOS)
    nome = os.path.splitext(os.path.basename(caminho))[0] + ".webp"
    im.save(os.path.join(DESTINO, nome), "WEBP", quality=88, method=6)
    print(nome)
