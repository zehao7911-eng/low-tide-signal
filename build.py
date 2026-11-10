from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re

root = Path(__file__).resolve().parent


def module(filename, binding=None):
    source = (root / filename).read_text(encoding='utf-8-sig')
    exports = re.findall(r'^export (?:function|class|const) (\w+)', source, re.M)
    source = re.sub(r'^import .*;\n', '', source, flags=re.M)
    source = re.sub(r'^export ', '', source, flags=re.M)
    if binding == 'ChannelArt':
        source = 'const {HarborView}=Art;\n' + source
    if binding:
        return f"const {binding}=(()=>{{\n{source}\nreturn {{{','.join(exports)}}};}})();\n"
    return source


style = (root / 'style.css').read_text(encoding='utf-8')
three = (root / 'vendor/three.min.js').read_text(encoding='utf-8')
notice = (root / 'vendor/THREE-LICENSE.txt').read_text(encoding='utf-8')

code = ''.join(module(n, bind) for n, bind in [
    ('core.mjs', 'C'), ('art.mjs', 'Art'), ('audio.mjs', 'AudioKit'), ('sdk.mjs', 'SDK'),
    ('channel.mjs', 'R'), ('channel-view.mjs', 'ChannelArt')
])
code += 'const {HarborView}=Art,{HarborAudio}=AudioKit,{bridge}=SDK,{ChannelView}=ChannelArt;\n' + module('app.mjs')
html = (root / 'index-source.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + style + '\n</style>')
html = html.replace('<script src="vendor/three.min.js"></script>', '<script>\n/*\n' + notice + '\n*/\n' + three + '\n</script>')
html = html.replace('<script type="module" src="app.mjs"></script>', '<script>(()=>{\n' + code + '\n})();</script>')
for entry in ('index.html', 'standalone.html'):
    (root / entry).write_text(html, encoding='utf-8', newline='\n')

package = root.parent / 'LOW-TIDE-SIGNAL.zip'
files = sorted(p for p in root.rglob('*') if p.is_file())
with ZipFile(package, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for file in files:
        archive.write(file, file.relative_to(root).as_posix())
with ZipFile(package) as archive:
    assert archive.testzip() is None
    assert archive.read('index.html') == archive.read('standalone.html')
    assert all(archive.read(file.relative_to(root).as_posix()) == file.read_bytes() for file in files)
print(f'{package.name}: {len(files)} files, {package.stat().st_size:,} bytes')
