/* Stable ordering, independent of text length and per-record replacement. */
(function(root){'use strict';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const identity=row=>row?.kind==='linkedEvent'?`linkedEvent:${row.timelineId}:${row.eventId}`:['event','timeline'].includes(row?.kind)?`${row.kind}:${row.id}`:String(row?.id??'');
function events(rows){return rows.map((row,index)=>({row,index,value:row.order!==null&&row.order!==undefined&&row.order!==''&&Number.isFinite(Number(row.order))?Number(row.order):index})).sort((a,b)=>a.value-b.value||a.index-b.index).map(item=>item.row);}
const ids=(rows,key='')=>(key==='events'?events(rows):rows).map(identity);
function reconcile(preferred,other){const result=[...new Set(preferred)],present=new Set(result);for(let i=0;i<other.length;i++){const id=other[i];if(present.has(id))continue;const next=other.slice(i+1).find(key=>present.has(key));if(next!==undefined)result.splice(result.indexOf(next),0,id);else result.push(id);present.add(id);}return result;}
function reorder(rows,preferred,other=[]){const map=new Map(rows.map(row=>[identity(row),row])),sequence=reconcile(preferred,other);return reconcile(sequence,rows.map(identity)).filter(id=>map.has(id)).map(id=>map.get(id));}
function changed(sequence,base){const shared=new Set(sequence.filter(id=>base.includes(id)));return !equal(sequence.filter(id=>shared.has(id)),base.filter(id=>shared.has(id)));}
function choice(local,remote,base){if(base&&!changed(remote,base)&&changed(local,base))return 'local';return 'remote';}
function mergeRows(local,remote,base){const lm=new Map(local.map(row=>[identity(row),row])),rm=new Map(remote.map(row=>[identity(row),row])),bm=new Map((base||[]).map(row=>[identity(row),row]));const preferred=choice(ids(local),ids(remote),base?ids(base):undefined)==='local'?local:remote,other=preferred===local?remote:local;const rows=[...new Set([...lm.keys(),...rm.keys()])].map(id=>{const l=lm.get(id),r=rm.get(id),b=bm.get(id);return r===undefined?l:l===undefined?r:b&&equal(r,b)&&!equal(l,b)?l:r;});return reorder(rows,ids(preferred),ids(other));}
const api={identity,events,ids,reconcile,reorder,choice,changed,mergeRows};root.SaveOrder=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
