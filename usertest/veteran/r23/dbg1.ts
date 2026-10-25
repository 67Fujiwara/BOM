import { parseTable } from './h22.ts'
const t = 'v00,v01,v02,v03,v04\nv10,v11,v12,v13,"a, b 1"\nv20,v21,"a, b 2",v23,"a, b 2"\nv30,v31,"w00\nw10, w11\nw20",v33,v34\nv40,v41,"a, b 4",v43,"a, b 4"\n"a, b 5",v51,v52,v53,"w00, w01, w02\nw10, w11\nw20"\n'
console.log(JSON.stringify(parseTable(t, ',')))
const t2 = 'v00,v01,v02,v03,v04\nv30,v31,"w00\nw10, w11\nw20",v33,v34\n'
console.log(JSON.stringify(parseTable(t2, ',')))
const t3 = 'v00,v01,v02,v03,v04\nv40,v41,"a, b 4",v43,"a, b 4"\n"a, b 5",v51,v52,v53,"w00, w01, w02\nw10, w11\nw20"\n'
console.log(JSON.stringify(parseTable(t3, ',')))
const t4 = 'v00,v01,v02,v03,v04\n"a, b 5",v51,v52,v53,"w00, w01, w02\nw10, w11\nw20"\n'
console.log(JSON.stringify(parseTable(t4, ',')))
const t5 = 'v00,v01,v02,v03,v04\nv51,v52,v53,v54,"w00, w01, w02\nw10, w11\nw20"\n'
console.log(JSON.stringify(parseTable(t5, ',')))
