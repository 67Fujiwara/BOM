#!/bin/bash
cd /home/user/BOM/usertest/veteran/r23
for d in , $'\t'; do
  DELIM=$d N=60000 nice -n 8 ./probe.sh 260-quote-fuzz.ts head >> batchQ.status
  DELIM=$d N=60000 nice -n 8 ./probe.sh 260-quote-fuzz.ts r21b >> batchQ.status
  mv 260-quote-fuzz.log 260-quote-fuzz-$([ "$d" = "," ] && echo csv || echo tsv).log
  mv 260-quote-fuzz-r21b.log 260-quote-fuzz-$([ "$d" = "," ] && echo csv || echo tsv)-r21b.log
done
echo DONE >> batchQ.status
