const fs=require("fs"),path=require("path");
const root=process.cwd(),html=[];
function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory()&&!["node_modules",".git","dist"].includes(n))walk(p);else if(s.isFile()&&n.endsWith(".html"))html.push(p)}}
walk(root);const bad=[];const re=/(?:src|href)=["']([^"'#?]+)["']/gi;
for(const f of html){const t=fs.readFileSync(f,"utf8");let m;while((m=re.exec(t))){const v=m[1];if(/^(https?:|data:|mailto:|javascript:)/i.test(v))continue;const target=v.startsWith("/sales-order-management/")?v.slice("/sales-order-management/".length):v.startsWith("/")?v.slice(1):v;if(!fs.existsSync(path.resolve(path.dirname(f),target)))bad.push(f+" -> "+v)}}
if(bad.length){console.error(bad.join("\n"));process.exit(1)}console.log("check-links: PASS");
