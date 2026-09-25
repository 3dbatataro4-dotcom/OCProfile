const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
function allowedOrigin(origin,env){return origin===env.ALLOWED_ORIGIN||origin==='http://127.0.0.1:8123'||origin==='http://localhost:8123';}
function cors(request,env){const origin=request.headers.get('Origin')||'';return allowedOrigin(origin,env)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Vary':'Origin'}:{};}
export default {
  async fetch(request,env){
    const headers=cors(request,env);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    try{
      const origin=request.headers.get('Origin');
      if(origin&&!allowedOrigin(origin,env))return json({error:'網站來源不允許。'},403,headers);
      const path=new URL(request.url).pathname;
      const match=path.match(/^\/media\/([a-zA-Z0-9_-]{1,100})$/);
      if(!match)return json({error:'找不到素材。'},404,headers);
      const bearer=request.headers.get('Authorization')||'';
      if(!bearer.startsWith('Bearer '))return json({error:'請先登入雲端帳號。'},401,headers);
      const auth=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:bearer}});
      if(!auth.ok)return json({error:'登入已過期，請重新登入。'},401,headers);
      const user=await auth.json();
      if(!user?.id)return json({error:'帳號驗證失敗。'},401,headers);
      const key=`${user.id}/${match[1]}`;
      if(request.method==='PUT'){
        const type=request.headers.get('Content-Type')||'';
        const image=/^image\/(png|jpeg|webp|gif|avif)$/i.test(type);
        const audio=/^audio\/(mpeg|mp4|ogg|wav|x-wav|webm)$/i.test(type);
        if(!image&&!audio)return json({error:'僅支援 PNG、JPEG、WebP、GIF、AVIF 圖片及 MP3、M4A、OGG、WAV、WebM 音訊。'},415,headers);
        const maxSize=(image?20:50)*1024*1024;
        const length=Number(request.headers.get('Content-Length'));
        if(length>maxSize)return json({error:`素材不得超過 ${image?20:50} MB。`},413,headers);
        const bytes=await request.arrayBuffer();
        if(!bytes.byteLength||bytes.byteLength>maxSize)return json({error:'素材大小不符。'},413,headers);
        await env.IMAGES.put(key,bytes,{httpMetadata:{contentType:type}});
        return json({key:match[1],size:bytes.byteLength},200,headers);
      }
      if(request.method==='GET'){
        const object=await env.IMAGES.get(key);
        if(!object)return json({error:'素材不存在。'},404,headers);
        return new Response(object.body,{headers:{...headers,'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=300'}});
      }
      if(request.method==='DELETE'){await env.IMAGES.delete(key);return json({deleted:true},200,headers);}
      return json({error:'不支援此操作。'},405,headers);
    }catch(error){console.error(error);return json({error:'素材服務暫時無法使用。'},500,headers);}
  }
};
