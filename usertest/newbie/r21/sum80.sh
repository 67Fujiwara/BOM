#!/bin/bash
# r80/r82 の出力を 1 ケース 1〜2 行に要約: 題 → 作成された行(部品名|型式|数量|備考) → 問題 → 公開
awk '/^\[/{if(t!="")print t" ## "c" ## "p" ## "u; t=$0; sub(/ preview:.*/,"",t); c="";p="";u=""} /^   created rows=/{c=$0; sub(/^   created rows=/,"",c); gsub(/\{\|\|/,"{",c)} /^   problems:/{p=$0; sub(/^   problems: /,"",p); p=substr(p,1,120)} /^   Ctrl\+Enter/{u=substr($0,18,70)} END{print t" ## "c" ## "p" ## "u}' "$1"
