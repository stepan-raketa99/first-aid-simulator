"""Optional development audit: fetch official text, never used by the game."""
import argparse
import hashlib
import io
import os
import re
import sys
import urllib.request
from html.parser import HTMLParser

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
        if tag in ('p','li','h1','h2','h3','br'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.skip = max(0, self.skip - 1)
    def handle_data(self, text):
        if not self.skip: self.parts.append(text)

parser = argparse.ArgumentParser()
parser.add_argument('urls', nargs='+')
parser.add_argument('--links',action='store_true')
parser.add_argument('--forms',action='store_true')
args = parser.parse_args()
sys.stdout.reconfigure(encoding='utf-8')
for url in args.urls:
    print('\nSOURCE:', url, flush=True)
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
        data = urllib.request.urlopen(req, timeout=40).read()
        if data.startswith(b'%PDF'):
            sys.path.insert(0, os.path.join(os.environ['TEMP'],'opencode','pdf-review-deps'))
            from pypdf import PdfReader
            print('SHA256:',hashlib.sha256(data).hexdigest())
            for n, page in enumerate(PdfReader(io.BytesIO(data)).pages): print(f'\nPAGE {n+1}\n{page.extract_text()}')
        else:
            html = data.decode('utf-8')
            if args.forms:
                for form in re.findall(r'<form\b[\s\S]*?</form>',html):
                    print(re.findall(r'<(?:form|input)\b[^>]*>',form))
                continue
            if args.links:
                for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>',html):
                    text = Text(); text.feed(label); label = ' '.join(''.join(text.parts).split())
                    if any(word in label.lower() + href.lower() for word in ['инсульт','insult','дефибрил','defibril','пособи','posobi','учебн','uchebn']): print(href,label)
                continue
            heading = re.search(r'<h1\b[^>]*>',html)
            if heading: html = html[heading.start():]
            text = Text(); text.feed(html)
            result = ''.join(text.parts).split('Поделиться:')[0]
            result = re.sub(r'[ \t]+',' ',result)
            result = re.sub(r'\n\s*\n','\n',result)
            print(result.strip())
    except Exception as error:
        print('UNAVAILABLE:',type(error).__name__,str(error))
