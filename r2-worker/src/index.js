const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
function allowedOrigin(origin,env){return origin===env.ALLOWED_ORIGIN||origin==='http://127.0.0.1:8123'||origin==='http://localhost:8123'||origin==='http://127.0.0.1:8765'||origin==='http://localhost:8765';}
function cors(request,env){const origin=request.headers.get('Origin')||'';return allowedOrigin(origin,env)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,HEAD,PUT,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,Range','Access-Control-Expose-Headers':'Accept-Ranges,Content-Range,Content-Length,Content-Type','Vary':'Origin'}:{};}
async function signature(secret,value){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function verifySignature(secret,value,sig){try{return await signature(secret,value)===sig;}catch{return false;}}
function privateError(status,message,headers){return json({error:message},status,headers);}
export default {
  async fetch(request,env){
    const headers=cors(request,env);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    try{
      const origin=request.headers.get('Origin');
      if(origin&&!allowedOrigin(origin,env))return json({error:'網站來源不允許。'},403,headers);
      const url=new URL(request.url),path=url.pathname;
      const streamMatch=path.match(/^\/stream\/([a-zA-Z0-9_-]{1,100})$/);
      if(streamMatch){
        const owner=url.searchParams.get('owner')||'',expires=Number(url.searchParams.get('expires')),sig=url.searchParams.get('sig')||'';
        if(!/^[a-zA-Z0-9_-]{1,100}$/.test(owner)||!Number.isFinite(expires)||expires<Date.now()/1000||expires>Date.now()/1000+7*86400+60||!env.MUSIC_SIGNING_SECRET||!await verifySignature(env.MUSIC_SIGNING_SECRET,`${owner}/${streamMatch[1]}:${expires}`,sig))return privateError(403,'播放連結無效或已過期。',headers);
        const object=await env.IMAGES.get(`${owner}/${streamMatch[1]}`,{range:request.headers});
        if(!object)return privateError(404,'媒體不存在。',headers);
        const responseHeaders=new Headers(headers);object.writeHttpMetadata(responseHeaders);responseHeaders.set('Accept-Ranges','bytes');responseHeaders.set('Cache-Control','private, max-age=300');
        if(object.range){const {offset,length}=object.range;responseHeaders.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);responseHeaders.set('Content-Length',String(length));return new Response(request.method==='HEAD'?null:object.body,{status:206,headers:responseHeaders});}
        responseHeaders.set('Content-Length',String(object.size));return new Response(request.method==='HEAD'?null:object.body,{headers:responseHeaders});
      }
      const match=path.match(/^\/media\/([a-zA-Z0-9_-]{1,100})(\/ticket)?$/);
      if(!match)return json({error:'找不到素材。'},404,headers);
      const bearer=request.headers.get('Authorization')||'';
      if(!bearer.startsWith('Bearer '))return json({error:'請先登入雲端帳號。'},401,headers);
      const auth=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:bearer}});
      if(!auth.ok)return json({error:'登入已過期，請重新登入。'},401,headers);
      const user=await auth.json();
      if(!user?.id)return json({error:'帳號驗證失敗。'},401,headers);
      const key=`${user.id}/${match[1]}`;
      const action=url.searchParams.get('action');
      if(action==='mpu-create'&&request.method==='POST'){
        const type=url.searchParams.get('contentType')||'';
        if(!/^audio\/(mpeg|mp4|ogg|wav|x-wav|webm|aac|flac)$/i.test(type)&&!/^video\/(mp4|webm|quicktime|ogg)$/i.test(type))return json({error:'分段上傳僅支援音訊與影片。'},415,headers);
        const upload=await env.IMAGES.createMultipartUpload(key,{httpMetadata:{contentType:type,cacheControl:'private, max-age=300'},customMetadata:{owner:user.id,kind:type.startsWith('audio/')?'audio':'video'}});
        return json({key:match[1],uploadId:upload.uploadId},200,headers);
      }
      if(action==='mpu-uploadpart'&&request.method==='PUT'){
        const uploadId=url.searchParams.get('uploadId')||'',partNumber=Number(url.searchParams.get('partNumber'));
        if(!uploadId||!Number.isInteger(partNumber)||partNumber<1||partNumber>10000||!request.body)return json({error:'分段上傳參數不完整。'},400,headers);
        const part=await env.IMAGES.resumeMultipartUpload(key,uploadId).uploadPart(partNumber,request.body);
        return json(part,200,headers);
      }
      if(action==='mpu-complete'&&request.method==='POST'){
        const uploadId=url.searchParams.get('uploadId')||'',payload=await request.json();
        if(!uploadId||!Array.isArray(payload?.parts)||!payload.parts.length)return json({error:'缺少待完成的上傳分段。'},400,headers);
        const object=await env.IMAGES.resumeMultipartUpload(key,uploadId).complete(payload.parts);
        return json({key:match[1],size:object.size},200,headers);
      }
      if(action==='mpu-abort'&&request.method==='DELETE'){
        const uploadId=url.searchParams.get('uploadId')||'';if(!uploadId)return json({error:'缺少上傳識別碼。'},400,headers);
        await env.IMAGES.resumeMultipartUpload(key,uploadId).abort();return json({aborted:true},200,headers);
      }
      if(match[2]==='/ticket'&&request.method==='GET'){
        if(!env.MUSIC_SIGNING_SECRET)return privateError(503,'R2 尚未設定音樂播放簽名密鑰。',headers);
        const expires=Math.floor(Date.now()/1000)+7*86400,sig=await signature(env.MUSIC_SIGNING_SECRET,`${user.id}/${match[1]}:${expires}`);
        return json({url:`${url.origin}/stream/${encodeURIComponent(match[1])}?owner=${encodeURIComponent(user.id)}&expires=${expires}&sig=${encodeURIComponent(sig)}`,expires},200,headers);
      }
      if(request.method==='PUT'){
        const type=request.headers.get('Content-Type')||'';
        const image=/^image\/(png|jpeg|webp|gif|avif)$/i.test(type);
        const audio=/^audio\/(mpeg|mp4|ogg|wav|x-wav|webm|aac|flac)$/i.test(type);
        const video=/^video\/(mp4|webm|quicktime|ogg)$/i.test(type);
        if(!image&&!audio&&!video)return json({error:'支援常見圖片、MP3／M4A／OGG／WAV／FLAC 音訊，以及 MP4／WebM／MOV／OGG 影片。'},415,headers);
        const maxSize=image?20*1024*1024:100*1024*1024;
        const length=Number(request.headers.get('Content-Length'));
        if(length>maxSize)return json({error:`單次上傳不得超過 ${image?20:100} MB；較大的音樂或影片請使用分段上傳。`},413,headers);
        if(!request.body||length===0)return json({error:'素材大小不符。'},413,headers);
        await env.IMAGES.put(key,request.body,{httpMetadata:{contentType:type,cacheControl:'private, max-age=300'},customMetadata:{owner:user.id,kind:image?'image':audio?'audio':'video'}});
        return json({key:match[1],size:length||null},200,headers);
      }
      if(request.method==='GET'||request.method==='HEAD'){
        const object=await env.IMAGES.get(key,{range:request.headers});
        if(!object)return json({error:'素材不存在。'},404,headers);
        const responseHeaders=new Headers(headers);object.writeHttpMetadata(responseHeaders);responseHeaders.set('Accept-Ranges','bytes');
        if(object.range){const {offset,length}=object.range;responseHeaders.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);responseHeaders.set('Content-Length',String(length));return new Response(request.method==='HEAD'?null:object.body,{status:206,headers:responseHeaders});}
        responseHeaders.set('Content-Length',String(object.size));return new Response(request.method==='HEAD'?null:object.body,{headers:responseHeaders});
      }
      if(request.method==='DELETE'){await env.IMAGES.delete(key);return json({deleted:true},200,headers);}
      return json({error:'不支援此操作。'},405,headers);
    }catch(error){console.error(error);return json({error:'素材服務暫時無法使用。'},500,headers);}
  }
};
