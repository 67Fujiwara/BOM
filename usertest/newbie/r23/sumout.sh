#!/bin/bash
# 使い方: sumout.sh results/X.out [grep]  各ケースの「題 → new」を 1 行で
awk '/^\[/{t=$0; sub(/ (INFO|OK|MISMATCH).*/,"",t); st=$0; next} /^   new:/{n=$0; sub(/ \| map=.*/,"",n); sub(/^   new: /,"",n); w=(st ~ /old≠new/)?"*":" "; print w " " t " => " n}' "$1" | { if [ -n "$2" ]; then grep -E "$2"; else cat; fi; }
