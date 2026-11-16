"""Rasterize the existing ziggurat, not a redesigned or generated identity.
Requires cairosvg and Pillow only when regenerating assets; PNGs ship in source.
"""
from pathlib import Path
import io
import cairosvg
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
svg = (ROOT / 'public/nabu-icon.svg').read_text()
source = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=1024, output_height=1024))).convert('RGBA')
icons=ROOT/'public/icons'; icons.mkdir(exist_ok=True)
for name,size in [('icon-192.png',192),('icon-512.png',512),('apple-touch-icon.png',180),('favicon-32.png',32)]:
    source.resize((size,size),Image.Resampling.LANCZOS).save(icons/name)
mask=Image.new('RGBA',(512,512),'#103a35');scaled=source.resize((384,384),Image.Resampling.LANCZOS);mask.alpha_composite(scaled,(64,64));mask.save(icons/'maskable-512.png')
assets=ROOT/'mobile/assets';assets.mkdir(exist_ok=True)
# iOS marketing icons must not have transparency.
solid=Image.new('RGB',(1024,1024),'#103a35');solid.paste(source,(0,0),source.getchannel('A'));solid.save(assets/'icon-1024.png')
for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    directory=assets/'android'/('mipmap-'+density);directory.mkdir(parents=True,exist_ok=True)
    for name in ('ic_launcher.png','ic_launcher_round.png'):
        solid.resize((size,size),Image.Resampling.LANCZOS).save(directory/name)
    foreground=Image.new('RGBA',(int(size*2.25),int(size*2.25)))
    mark=source.resize((int(size*1.4),int(size*1.4)),Image.Resampling.LANCZOS)
    xy=((foreground.width-mark.width)//2,)*2;foreground.alpha_composite(mark,xy)
    foreground.save(directory/'ic_launcher_foreground.png')
for name in ('mipmap-anydpi-v26/ic_launcher.xml','mipmap-anydpi-v26/ic_launcher_round.xml'):
    p=assets/'android'/name;p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/nabu_icon_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n')
p=assets/'android/values/nabu_colors.xml';p.parent.mkdir(exist_ok=True);p.write_text('<resources><color name="nabu_icon_background">#103a35</color></resources>\n')
splash=Image.new('RGB',(2732,2732),'#103a35');splash.paste(solid.resize((600,600)),(1066,1066));splash.save(assets/'splash.png')
print('Generated ziggurat PNG, maskable, Apple touch and native icon assets.')
