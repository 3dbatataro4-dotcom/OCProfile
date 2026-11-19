/*
 * Transparent compression for large localStorage values.
 *
 * The whole workshop lives in localStorage, which browsers cap at roughly five million characters per site.
 * Values above THRESHOLD are stored LZ-compressed (UTF-16 safe, the lz-string "compressToUTF16" format) behind
 * a marker; getItem hands back the original text, so every existing caller keeps working unchanged.
 * Must load before any script that reads or writes localStorage.
 */
(function(){
  'use strict';
  if(window.OCStorageCompress)return;
  const MARK='\u0001ocz1\u0001',THRESHOLD=64*1024;
  const proto=Storage.prototype,rawGet=proto.getItem,rawSet=proto.setItem,rawRemove=proto.removeItem,rawClear=proto.clear;

  function compress(text,bitsPerChar,charFromInt){
    if(text==null)return '';
    const dictionary=new Map(),toCreate=new Set(),out=[];
    let w='',enlargeIn=2,dictSize=3,numBits=2,value=0,position=0;
    const writeBit=bit=>{value=(value<<1)|bit;if(position===bitsPerChar-1){position=0;out.push(charFromInt(value));value=0;}else position++;};
    const writeBits=(n,count)=>{for(let i=0;i<count;i++){writeBit(n&1);n>>=1;}};
    const emit=()=>{
      if(toCreate.has(w)){const code=w.charCodeAt(0);if(code<256){writeBits(0,numBits);writeBits(code,8);}else{writeBits(1,numBits);writeBits(code,16);}
        if(--enlargeIn===0){enlargeIn=2**numBits;numBits++;}toCreate.delete(w);}
      else writeBits(dictionary.get(w),numBits);
      if(--enlargeIn===0){enlargeIn=2**numBits;numBits++;}
    };
    for(let i=0;i<text.length;i++){
      const c=text.charAt(i);
      if(!dictionary.has(c)){dictionary.set(c,dictSize++);toCreate.add(c);}
      const wc=w+c;
      if(dictionary.has(wc))w=wc;
      else{emit();dictionary.set(wc,dictSize++);w=c;}
    }
    if(w!=='')emit();
    writeBits(2,numBits);
    while(true){value<<=1;if(position===bitsPerChar-1){out.push(charFromInt(value));break;}position++;}
    return out.join('');
  }

  function decompress(length,resetValue,nextValue){
    const dictionary=[0,1,2],result=[];
    let enlargeIn=4,dictSize=4,numBits=3,entry='',w,c;
    const data={val:nextValue(0),position:resetValue,index:1};
    const readBits=count=>{let bits=0,power=1;const max=2**count;while(power!==max){const resb=data.val&data.position;data.position>>=1;if(data.position===0){data.position=resetValue;data.val=nextValue(data.index++);}bits|=(resb>0?1:0)*power;power<<=1;}return bits;};
    switch(readBits(2)){
      case 0:c=String.fromCharCode(readBits(8));break;
      case 1:c=String.fromCharCode(readBits(16));break;
      case 2:return '';
    }
    dictionary[3]=c;w=c;result.push(c);
    while(true){
      if(data.index>length)return '';
      let code=readBits(numBits);
      switch(code){
        case 0:dictionary[dictSize++]=String.fromCharCode(readBits(8));code=dictSize-1;enlargeIn--;break;
        case 1:dictionary[dictSize++]=String.fromCharCode(readBits(16));code=dictSize-1;enlargeIn--;break;
        case 2:return result.join('');
      }
      if(enlargeIn===0){enlargeIn=2**numBits;numBits++;}
      if(dictionary[code]!==undefined)entry=dictionary[code];
      else if(code===dictSize)entry=w+w.charAt(0);
      else return null;
      result.push(entry);
      dictionary[dictSize++]=w+entry.charAt(0);
      enlargeIn--;
      w=entry;
      if(enlargeIn===0){enlargeIn=2**numBits;numBits++;}
    }
  }

  const compressToUTF16=text=>compress(text,15,a=>String.fromCharCode(a+32))+' ';
  const decompressFromUTF16=data=>data==null?'':data===''?null:decompress(data.length,16384,i=>data.charCodeAt(i)-32);

  // Last plain value per key: repeated saves of unchanged data skip the (slow) compression and the write.
  const plain=new Map();
  const isLocal=store=>{try{return store===window.localStorage;}catch{return false;}};

  proto.getItem=function(key){
    const stored=rawGet.call(this,key);
    if(stored==null||!isLocal(this)||!stored.startsWith(MARK))return stored;
    const cached=plain.get(String(key));if(cached&&cached.stored===stored)return cached.value;
    const value=decompressFromUTF16(stored.slice(MARK.length));
    if(value==null){console.error('[storage] 無法解壓縮',key);return null;}
    plain.set(String(key),{stored,value});return value;
  };
  proto.setItem=function(key,value){
    if(!isLocal(this))return rawSet.call(this,key,value);
    key=String(key);value=String(value);
    const cached=plain.get(key);
    if(cached&&cached.value===value&&rawGet.call(this,key)===cached.stored)return;
    if(value.length<THRESHOLD){plain.delete(key);return rawSet.call(this,key,value);}
    const stored=MARK+compressToUTF16(value);
    rawSet.call(this,key,stored);plain.set(key,{stored,value});
  };
  proto.removeItem=function(key){if(isLocal(this))plain.delete(String(key));return rawRemove.call(this,key);};
  proto.clear=function(){if(isLocal(this))plain.clear();return rawClear.call(this);};

  /* Re-store existing large values compressed, freeing room before the app starts writing. */
  function compactExisting(){
    try{const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
      for(const key of keys){const stored=rawGet.call(localStorage,key);if(stored&&stored.length>=THRESHOLD&&!stored.startsWith(MARK)){try{localStorage.setItem(key,stored);}catch(error){console.warn('[storage] 壓縮失敗',key,error);}}}
    }catch(error){console.warn('[storage] 壓縮既有資料失敗',error);}
  }
  function usage(){let raw=0,logical=0;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i),stored=rawGet.call(localStorage,key)||'';raw+=key.length+stored.length;logical+=key.length+(localStorage.getItem(key)||'').length;}return {stored:raw,original:logical};}

  window.OCStorageCompress={compressToUTF16,decompressFromUTF16,compactExisting,usage,MARK,THRESHOLD};
  compactExisting();
})();
