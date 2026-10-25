#!/bin/bash
# 2 回目（-run2）
cd /home/user/BOM/usertest/veteran/r20
while [ ! -f 164.status ]; do sleep 5; done
export BOM_URL=http://localhost:5176/
nice -n 5 env RUN=-run2 node 158-importdel-undo.mjs > 158-importdel-undo-run2.log 2>&1
nice -n 5 env RUN=-run2 node 161-importdel-roles.mjs > 161-importdel-roles-run2.log 2>&1
nice -n 5 env RUN=-run2 node 163-importdel-bulk-paste.mjs > 163-importdel-bulk-paste-run2.log 2>&1
nice -n 5 env RUN=-run2 node 151b-importdel-fixloop.mjs > 151b-importdel-fixloop-run2.log 2>&1
nice -n 5 env RUN=-run2 PORT=5176 node 157-ui-misc.mjs > 157-ui-misc-5176-run2.log 2>&1
nice -n 5 env RUN=-run2 PORT=5176 node 159-paste-trim.mjs > 159-paste-trim-5176-run2.log 2>&1
nice -n 5 env RUN=-run2 PORT=5176 node 164-case-row-keys.mjs > 164-case-row-keys-5176-run2.log 2>&1
echo done > batchR2.status
