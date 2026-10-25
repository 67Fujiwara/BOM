import sys,re
# r00_oldnew の出力から、old と new の解析結果が違う入力だけを出す
for fn in sys.argv[1:]:
    txt=open(fn,encoding='utf8').read()
    blocks=re.split(r'\n(?=\[)',txt)
    same=0;diff=0
    for b in blocks:
        m=re.match(r'\[(.*?)\]\n',b)
        if not m: continue
        body=b[m.end():]
        parts=re.split(r'\n  new: ',body)
        if len(parts)<2: continue
        old=parts[0].replace('  old: ','',1); new=parts[1]
        if old.strip()==new.strip(): same+=1; continue
        diff+=1
        print('=====',fn,m.group(1)); print('OLD',old.strip()[:900]); print('NEW',new.strip()[:900])
    print('##',fn,'same',same,'diff',diff)
