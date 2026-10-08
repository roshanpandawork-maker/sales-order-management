const fs=require("node:fs"),path=require("node:path");
const sql=fs.readdirSync("supabase").filter(x=>x.endsWith(".sql")).map(x=>fs.readFileSync(path.join("supabase",x),"utf8")).join("\n");
const contract=JSON.parse(fs.readFileSync(path.join("supabase","production-schema-contract.json"),"utf8"));
const refs=new Set();
for(const f of fs.readdirSync("js")){
  if(!f.endsWith(".js"))continue;
  const source=fs.readFileSync(path.join("js",f),"utf8");
  for(const m of source.matchAll(/\.from\(["']([^"']+)["']\)/g))refs.add(m[1]);
}
const externallyManaged=new Set(contract.applicationTablesAvailableInProduction||[]);
const missing=[...refs].filter(name=>!new RegExp("\\b"+name+"\\b","i").test(sql)&&!externallyManaged.has(name));
if(missing.length){console.error("Missing SQL table refs: "+missing.join(", "));process.exit(1)}
console.log("check-schema-refs: PASS");
