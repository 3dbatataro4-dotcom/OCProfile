/* Script graph shared with the visual novel line parser. Branches rejoin at @choose_off. */
(function(root){
  'use strict';
  const normalize=s=>String(s||'').replace(/^[ \t]*sys\(([^()]*)\)[ \t]*$/gmi,(_,body)=>'@'+body.split(':').map(x=>x.trim()).join(' '));
  function compile(script,defaults={},parseLine){
    const lines=normalize(script).split(/\r?\n/).map((text,index)=>({text:text.trim(),index})).filter(r=>r.text);
    let cursor=0;
    const fail=(message,row=lines[cursor])=>{const error=Error(`第 ${(row?.index??0)+1} 行：${message}`);error.line=(row?.index??0)+1;throw error;};
    const initial={cg:defaults.cg||'',bg:defaults.bg||'',bgm:defaults.bgm||'',emotion:'平靜',overlay:'',overlayY:28,overlayWidth:100,pose:{},effects:[],se:'',variants:[]};
    const clone=o=>JSON.parse(JSON.stringify(o));
    function block(state,inside=false){const items=[];
      while(cursor<lines.length){const row=lines[cursor],line=row.text;
        if(/^@\[.*\]$/.test(line)||/^@choose_off$/i.test(line)){if(inside)break;fail('選項標記必須放在 @choose 和 @choose_off 之間。',row);}
        if(/^@choose$/i.test(line)){
          cursor++;let labels;const list=lines[cursor]?.text;if(list?.startsWith('[')){try{labels=JSON.parse(list);if(!Array.isArray(labels)||labels.some(v=>typeof v!=='string'||!v.trim()))fail('選項列表格式不正確。');labels=labels.map(v=>v.trim());}catch{fail('選項列表格式不正確，請透過選項模組重新插入。');}}else labels=list?.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
          if(!labels?.length||new Set(labels).size!==labels.length)fail('請在 @choose 下一行填寫一個或多個不重複的選項，例如 繼續 或 A,B。');cursor++;
          let question=items.at(-1);if(!question||question.branches){question={...clone(state),id:`script_${row.index}`,speaker:'旁白',text:'請選擇你的回答。',sourceLineIndex:row.index};items.push(question);}
          question.branches=[];const seen=new Set();
          while(cursor<lines.length&&!/^@choose_off$/i.test(lines[cursor].text)){
            const marker=lines[cursor].text.match(/^@\[(.+)\]$/);if(!marker)fail('每個選項內容需以 @[選項名稱] 開始。');const label=marker[1].trim();
            if(!labels.includes(label)||seen.has(label))fail('選項名稱必須對應上方列表，且不能重複。');seen.add(label);cursor++;
            const branch=block(clone(state),true);question.branches.push({text:label,items:branch});
          }
          if(cursor>=lines.length)fail('選項區塊缺少 @choose_off。',row);if(seen.size!==labels.length)fail('每個列出的選項都必須有 @[選項名稱] 區塊。',row);
          question.branches.sort((a,b)=>labels.indexOf(a.text)-labels.indexOf(b.text));cursor++;continue;
        }
        const media=line.match(/^@(cg|bg|bgm|se|overlay|emotion)\b\s*(.*)$/i);
        if(media){const key=media[1].toLowerCase();let value=media[2];if(!value&&key!=='emotion'&&/^(https?:|asset:|data:)/i.test(lines[cursor+1]?.text||''))value=lines[++cursor].text;if(!value)fail(`@${key} 後面需要網址、素材 ID、情緒或 none。`,row);state[key]=value==='default'?(defaults[key]||''):value==='none'?(key==='bgm'?'-':'none'):value;cursor++;continue;}
        const placement=line.match(/^@overlay_position\s+([\d.]+)\s+([\d.]+)$/i);
        if(placement){state.overlayY=Math.max(0,Math.min(100,Number(placement[1])));state.overlayWidth=Math.max(10,Math.min(100,Number(placement[2])));cursor++;continue;}
        const trust=line.match(/^@trust\s+([+-]?\d+)$/i);if(trust){state.trustDelta=(state.trustDelta||0)+Number(trust[1]);cursor++;continue;}
        const variant=line.match(/^@variant\s+([+-]?\d+)\s+(.+)$/i);if(variant){state.variants.push({minTrust:Number(variant[1]),text:variant[2]});cursor++;continue;}
        const effect=line.match(/^@(shake|jump)\b\s*(.*)$/i);if(effect){state.effects.push(effect[1].toLowerCase());cursor++;continue;}
        const pose=line.match(/^@(closer|move|front|flip|scale|hide)\b\s*(.*)$/i);
        if(pose){const name=pose[1].toLowerCase(),args=pose[2].split(/[\s:]+/).filter(Boolean);state.pose[name]=args;if(name==='hide')state.cg='none';cursor++;continue;}
        if(line.startsWith('@'))fail('無法辨識此指令，請查看語法說明。',row);
        const parsed=parseLine?.(line)||null,separator=line.includes('｜')?'｜':line.includes('|')?'|':null;
        let speaker=parsed?.speaker||(separator?line.slice(0,line.indexOf(separator)):'旁白'),text=parsed?.text??(separator?line.slice(line.indexOf(separator)+1):line);
        if(parsed?.emotion)state.emotion=parsed.emotion;const mood=speaker.match(/^(.*?)[（(【]([^）)】]+)[）)】]$/);if(mood){speaker=mood[1].trim();state.emotion=mood[2].trim();}
        items.push({...clone(state),id:`script_${row.index}`,speaker:speaker||'旁白',text,sourceLineIndex:row.index});state.se='';state.effects=[];state.trustDelta=0;state.variants=[];cursor++;
      }return items;
    }
    const ast=block(initial),scenes=[];
    function flatten(items){let start=null,tails=[];
      for(const item of items){const index=scenes.length;const {branches,...node}=item;scenes.push({...node,next:null,choices:[]});if(start===null)start=index;for(const tail of tails)scenes[tail].next=index;
        if(branches){tails=[];for(const branch of branches){const result=flatten(branch.items);scenes[index].choices.push({text:branch.text,target:result.start});if(result.start===null)tails.push(index);else tails.push(...result.tails);}scenes[index]._emptyBranches=scenes[index].choices.filter(c=>c.target===null);}
        else tails=[index];
      }return {start,tails};
    }
    const result=flatten(ast);for(const scene of scenes){for(const c of scene._emptyBranches||[])c.target=scene.next;delete scene._emptyBranches;}
    if(!scenes.length)throw Error('請至少寫下一句台詞。');return {scenes,entry:result.start||0};
  }
  function serialize(chapter){if(chapter.scriptText!==undefined)return normalize(chapter.scriptText);const out=[];
    for(const s of chapter.scenes||[]){out.push(`@cg ${s.cg||chapter.cg||'default'}`,`@bgm ${s.bgm||chapter.bgm||'none'}`,`@emotion ${s.emotion||'平靜'}`,`@overlay ${s.overlay||'none'}`,`@overlay_position ${s.overlayY??28} ${s.overlayWidth??100}`);if(s.se)out.push(`@se ${s.se}`);for(const v of s.variants||[])out.push(`@variant ${v.minTrust} ${v.text}`);out.push(`${s.speaker||'旁白'}｜${s.text||'（沉默）'}`);
      if(s.choices?.length){out.push('@choose',s.choices.map(c=>c.text.replace(/[,，\r\n]/g,' ')).join(','));for(const c of s.choices){const label=c.text.replace(/[,，\r\n]/g,' ');out.push(`@[${label}]`);if(c.emotion)out.push(`@emotion ${c.emotion}`);if(c.delta)out.push(`@trust ${c.delta}`);out.push(`${s.speaker||'旁白'}｜${c.response||'（沉默）'}`);}out.push('@choose_off');}
    }return out.join('\n\n');
  }
  root.OCVnScript={normalize,compile,serialize};
})(typeof window==='undefined'?globalThis:window);
