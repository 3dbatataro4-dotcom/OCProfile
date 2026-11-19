/* Birthdays are recurring month/day values; legacy ISO dates remain readable. */
(()=>{'use strict';
 const days=m=>[0,31,29,31,30,31,30,31,31,30,31,30,31][m]||31;
 function normalize(value){const match=String(value||'').trim().match(/^(?:\d{4,}-)?(\d{1,2})[-/](\d{1,2})$/);if(!match)return '';const m=Number(match[1]),d=Number(match[2]);return m>=1&&m<=12&&d>=1&&d<=days(m)?String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):'';}
 const format=value=>normalize(value).replace('-', '/');
 function rebuild(id,day=''){const month=document.getElementById(id+'Month'),date=document.getElementById(id+'Day');if(!month||!date)return;date.innerHTML='<option value="">日期</option>'+Array.from({length:days(Number(month.value))},(_,i)=>'<option value="'+String(i+1).padStart(2,'0')+'">'+(i+1)+' 日</option>').join('');date.value=Number(day)<=days(Number(month.value))?day:'';}
 function set(id,value){const field=document.getElementById(id),month=document.getElementById(id+'Month');if(!field||!month)return;const v=normalize(value);field.value=v;month.value=v.slice(0,2);rebuild(id,v.slice(3));}
 function read(id){const month=document.getElementById(id+'Month'),day=document.getElementById(id+'Day'),v=normalize(month?.value+'-'+day?.value);if(document.getElementById(id))document.getElementById(id).value=v;return v;}
 function valid(id){const m=document.getElementById(id+'Month')?.value,d=document.getElementById(id+'Day')?.value;return !m&&!d||!!normalize(m+'-'+d);}
 document.querySelectorAll('[data-birthday]').forEach(box=>{const id=box.dataset.birthday,month=document.getElementById(id+'Month');month.innerHTML='<option value="">月份</option>'+Array.from({length:12},(_,i)=>'<option value="'+String(i+1).padStart(2,'0')+'">'+(i+1)+' 月</option>').join('');set(id,document.getElementById(id).value);box.addEventListener('change',e=>{if(e.target===month)rebuild(id,document.getElementById(id+'Day').value);read(id);document.getElementById(id).dispatchEvent(new Event('input',{bubbles:true}));});box.querySelector('[data-birthday-clear]').onclick=()=>{set(id,'');document.getElementById(id).dispatchEvent(new Event('input',{bubbles:true}));};});
 window.OCBirthday={normalize,format,set,read,valid};
})();
