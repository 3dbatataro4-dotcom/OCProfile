/* Shared application roster: drafts remain in storage, but cannot participate. */
(()=>{'use strict';
const active=row=>!!row&&!row.isHidden;
const characterRows=()=>typeof characters==='undefined'?[]:characters;
const cpRows=()=>typeof cps==='undefined'?[]:cps;
window.OCRecordPolicy=Object.freeze({isActive:active,characters:()=>characterRows().filter(active),character:id=>characterRows().find(row=>active(row)&&String(row.id)===String(id)),cps:()=>cpRows().filter(row=>active(row)&&(row.members||[]).every(member=>characterRows().some(char=>active(char)&&String(char.id)===String(member.charId))))});
})();
