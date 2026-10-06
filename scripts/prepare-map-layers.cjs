// Preparation only: download Natural Earth shapefiles and process them with Mapshaper.
// node scripts/prepare-map-layers.cjs /path/to/node_modules/mapshaper /path/to/cache
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const packagePath=process.argv[2] || path.dirname(require.resolve('mapshaper/package.json'));
const cache=path.resolve(process.argv[3] || '/tmp/afl-natural-earth');
const dest=path.resolve(__dirname,'../data');
const previousManifest=fs.existsSync(path.join(dest,'map_sources.json'))?JSON.parse(fs.readFileSync(path.join(dest,'map_sources.json'))):null;
const cli=path.join(packagePath,'bin/mapshaper');
const version=JSON.parse(fs.readFileSync(path.join(packagePath,'package.json'))).version;
const bbox='110,-45,156,-10';
fs.mkdirSync(cache,{recursive:true});
const layers=[
 {name:'ocean',source:'50m_physical/ne_50m_ocean',category:'physical',retained:'20%'},
 {name:'graticules',source:'110m_physical/ne_110m_graticules_10',category:'reference grid',retained:'100%'},
 {name:'states',source:'10m_cultural/ne_10m_admin_1_states_provinces',category:'cultural',retained:'50%'}
];
const commands=[];
function run(args){
 // Keep reproducible argument lists without machine-specific cache paths.
 commands.push(args.map(arg=>arg.replace(cache,'$CACHE').replace(dest,'$DATA')));
 execFileSync(process.execPath,[cli,...args],{stdio:'inherit'});
}
for(const layer of layers){
 const basename=layer.source.split('/').pop();
 const zip=path.join(cache,basename+'.zip');
 layer.url='https://naturalearth.s3.amazonaws.com/'+layer.source+'.zip';
 if(!fs.existsSync(zip))execFileSync('curl',['-fsSL','--retry','2','--max-time','120',layer.url,'-o',zip]);
 const bytes=fs.readFileSync(zip);
 layer.download_bytes=bytes.length;
 layer.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const folder=path.join(cache,basename);
 fs.mkdirSync(folder,{recursive:true});
 execFileSync('unzip',['-q','-o',zip,'-d',folder]);
 const args=['-i',path.join(folder,basename+'.shp')];
 if(layer.name==='states')args.push('-filter','adm0_a3 === "AUS" && ["AU-NSW","AU-VIC","AU-QLD","AU-SA","AU-WA","AU-TAS","AU-NT","AU-ACT"].indexOf(iso_3166_2) >= 0',
  '-each','state=iso_3166_2.replace("AU-",""), state_name=name, state_code=({NSW:"1",VIC:"2",QLD:"3",SA:"4",WA:"5",TAS:"6",NT:"7",ACT:"8"})[state]',
  '-filter-fields','state,state_name,state_code');
 else args.push('-filter-fields');
 args.push('-clip','bbox='+bbox);
 if(layer.name!=='graticules')args.push('-clean','-simplify','weighted',layer.retained,'keep-shapes','-clean');
 args.push('-rename-layers',layer.name,'-o',path.join(cache,layer.name+'.geojson'),'format=geojson','force');
 run(args);
}
run(['-i',...['ocean','graticules'].map(n=>path.join(cache,n+'.geojson')),'combine-files',
 '-o',path.join(dest,'natural_earth_physical.topojson'),'format=topojson','quantization=100000','force']);
// Dissolve the prepared states into land without changing their shared coast.
// Export both objects together so fill and outlines reuse exactly the same arcs.
run(['-i',path.join(cache,'states.geojson'),'-dissolve','target=states','no-replace','name=land','gap-width=0',
 '-o',path.join(dest,'natural_earth_states.topojson'),'target=states,land','format=topojson','quantization=100000','force']);
const states=JSON.parse(fs.readFileSync(path.join(dest,'natural_earth_states.topojson')));
if(states.objects.states.geometries.length!==8)throw Error('Expected eight Australian state/territory features');
const manifest={
 provider:'Natural Earth',licence:'Public domain',licence_url:'https://www.naturalearthdata.com/about/terms-of-use/',
 retrieved:layers.every(layer=>previousManifest?.layers.some(old=>old.sha256===layer.sha256))?previousManifest.retrieved:new Date().toISOString().slice(0,10),
 processed:new Date().toISOString().slice(0,10),mapshaper_version:version,bbox:bbox.split(',').map(Number),
 method:'Import all shapefile sidecars; filter Australian states; clip to mainland Australia and Tasmania; clean; weighted Visvalingam simplification with keep-shapes; retain only join fields. Dissolve the prepared states into a land object without gap filling, and export land and states together so they share the same quantized coastline arcs.',
 land_derivation:{source:'states',operation:'Dissolve state polygons after simplification; remove internal boundaries; preserve exterior coast and islands.',output:'natural_earth_states.topojson',object:'land'},
 layers,commands,
 outputs:['natural_earth_physical.topojson','natural_earth_states.topojson'].map(file=>({file,bytes:fs.statSync(path.join(dest,file)).size})),
 colour:{provider:'ColorBrewer 2.0',scheme:'YlGnBu',classes:5,thresholds:[20,40,60,80],
  colours:['#ffffcc','#a1dab4','#41b6c4','#2c7fb8','#253494'],
  intervals:['0–<20%','20–<40%','40–<60%','60–<80%','80–100%'],
  url:'https://colorbrewer2.org/#type=sequential&scheme=YlGnBu&n=5',
  specification_source:'https://github.com/axismaps/colorbrewer/blob/master/colorbrewer_schemes.js'}
};
fs.writeFileSync(path.join(dest,'map_sources.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.outputs));
