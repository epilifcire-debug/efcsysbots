"""Monta os 7 robôs (ordem do fluxo) x 8 expressões a partir das imagens do Eric."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN = os.path.join(RAIZ, "assets", "referencias")
OUT = os.path.join(RAIZ, "assets", "sprites")
os.makedirs(OUT, exist_ok=True)

rosto = Image.open(f"{IN}/rosto_padrao.png").convert("RGB")
expr = Image.open(f"{IN}/expressoes.png").convert("RGB")

def telas(img, minarea=8000):
    a = np.asarray(img).astype(int)
    navy = (a[:, :, 0] < 50) & (a[:, :, 1] < 65) & (a[:, :, 2] > 40) & (a[:, :, 2] < 100)
    lab, _ = nd.label(navy)
    out = []
    for i, s in enumerate(nd.find_objects(lab)):
        if (lab[s] == i + 1).sum() > minarea:
            out.append((s[1].start, s[0].start, s[1].stop, s[0].stop))
    return sorted(out)

T_ROSTO = telas(rosto)      # ordem na imagem: chefe, pm, codigo, banco, docs, fluxos, uiux
T_EXPR = telas(expr)        # dormindo, acordando, feliz, repouso, pensando, trabalhando, erro, sucesso
assert len(T_ROSTO) == 7 and len(T_EXPR) == 8

ORDEM_IMG = ["chefe", "pm", "codigo", "banco", "docs", "fluxos", "uiux"]
FLUXO = [("chefe", "CHEFE"), ("pm", "PM"), ("uiux", "UI/UX"), ("codigo", "CÓDIGO"),
         ("banco", "BANCO DE DADOS / SQL"), ("fluxos", "FLUXOS / WORKFLOW"), ("docs", "DOCS")]
ESTADOS = ["dormindo", "acordando", "feliz", "repouso", "pensando", "trabalhando", "erro", "sucesso"]

INSET = 4
def rosto_de(estado):
    x0, y0, x1, y1 = T_EXPR[ESTADOS.index(estado)]
    return expr.crop((x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET))

def transparente(img):
    a = np.asarray(img).astype(int)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    perto = np.abs(a - bg).sum(2) < 26
    lab, _ = nd.label(perto)
    borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fundo = np.isin(lab, list(borda))
    alpha = np.where(fundo, 0, 255).astype(np.uint8)
    alpha = nd.grey_closing(alpha, size=2)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")

LARG, TOPO, BASE = 420, 78, 700
sprites = {}
for idx, func in enumerate(ORDEM_IMG):
    x0, y0, x1, y1 = T_ROSTO[idx]
    cx = (x0 + x1) // 2
    caixa = (cx - LARG // 2, TOPO, cx + LARG // 2, BASE)
    for est in ESTADOS:
        corpo = rosto.copy()
        if est != "repouso":
            face = rosto_de(est).resize((x1 - x0 - 2 * INSET, y1 - y0 - 2 * INSET), Image.LANCZOS)
            corpo.paste(face, (x0 + INSET, y0 + INSET))
        spr = transparente(corpo.crop(caixa))
        spr.save(f"{OUT}/{func}_{est}.png", optimize=True)
        sprites[(func, est)] = spr

# ---------- folhas ----------
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f_nome = ImageFont.truetype(FONT, 30)
f_tit = ImageFont.truetype(FONT, 44)
BG = (217, 224, 228)

def rotulo(d, cx, y, texto, fonte, cor=(30, 42, 56)):
    partes = texto.split(" / ")
    linhas = [partes[0] + " /", partes[1]] if len(partes) == 2 else [texto]
    for k, ln in enumerate(linhas):
        w = d.textlength(ln, font=fonte)
        d.text((cx - w / 2, y + k * 38), ln, font=fonte, fill=cor)

def folha_equipe(path):
    cw = 430
    W, H = 40 + cw * 7, 760
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    for i, (func, nome) in enumerate(FLUXO):
        x = 20 + i * cw
        im.paste(sprites[(func, "repouso")], (x + 5, 30), sprites[(func, "repouso")])
        rotulo(d, x + cw / 2, 650, nome, f_nome)
    im.save(path, optimize=True)

def folha_expressoes(path):
    cw, ch = 300, 370
    esc = 0.62
    W, H = 300 + cw * 8, 150 + ch * 7
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    for j, est in enumerate(ESTADOS):
        t = est.upper(); w = d.textlength(t, font=f_nome)
        d.text((300 + j * cw + cw / 2 - w / 2, 60), t, font=f_nome, fill=(30, 42, 56))
    for i, (func, nome) in enumerate(FLUXO):
        y = 120 + i * ch
        rotulo(d, 150, y + ch / 2 - 30, nome, ImageFont.truetype(FONT, 24))
        for j, est in enumerate(ESTADOS):
            s = sprites[(func, est)]
            s2 = s.resize((int(s.width * esc), int(s.height * esc)), Image.LANCZOS)
            im.paste(s2, (300 + j * cw + (cw - s2.width) // 2, y + 10), s2)
    im.save(path, optimize=True)

folha_equipe(os.path.join(RAIZ, "assets", "folhas", "equipe_rosto_padrao.png"))
folha_expressoes(os.path.join(RAIZ, "assets", "folhas", "equipe_expressoes.png"))
print("ok", len(sprites))
