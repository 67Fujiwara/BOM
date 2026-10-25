cd /home/user/BOM/usertest/veteran/r23
for w in head r22b; do for d in "," "$(printf '\t')"; do for m in rfc qc; do
 n=csv; [ "$d" != "," ] && n=tsv
 ( export DELIM="$d" MODE=$m N=30000; nice -n 8 ./probe.sh 305-rfc-wide.ts $w; ) >/dev/null 2>&1
 s=""; [ $w = r22b ] && s=-r22b
 mv 305-rfc-wide$s.log 305-$n-$m$s.log
done; done; done
echo finished > run305.done
