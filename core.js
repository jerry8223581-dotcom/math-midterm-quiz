(function(root,factory){const x=factory();if(typeof module==='object'&&module.exports)module.exports=x;else root.MathReviewCore=x;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const empty=()=>({version:1,attempts:[],reviewed:{},active:null,archivedQuizzes:[]});
 function pool(bank,year='all',unit='all'){return bank.filter(q=>(year==='all'||q.year===Number(year))&&(unit==='all'||q.unit===unit)&&q.status==='included');}
 function shuffle(list,count='all',random=Math.random){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,count==='all'?a.length:Math.min(Math.max(0,Number(count)||0),a.length));}
 function grade(quiz,bank,date=new Date().toISOString()){
  if(!quiz.ids.length||new Set(quiz.ids).size!==quiz.ids.length)throw Error('測驗題目無效');
  const lookup=new Map(bank.map(q=>[q.id,q]));
  return {id:quiz.id,date,items:quiz.ids.map(id=>{const q=lookup.get(id);if(!q)throw Error('不存在的題目');const selected=quiz.answers[id]??null;if(selected!==null&&!['A','B','C','D'].includes(selected))throw Error('答案格式無效');return {id,selected,key:q.answer,correct:selected===null?null:selected===q.answer};})};
 }
 function score(t){const total=t.items.length,right=t.items.filter(a=>a.correct===true).length,wrong=t.items.filter(a=>a.correct===false).length;return {total,right,wrong,blank:total-right-wrong,rate:total?Math.round(right/total*100):0};}
 function wrongs(state){const map=new Map();for(const t of state.attempts)for(const a of t.items)if(a.correct===false){const w=map.get(a.id)||{id:a.id,count:0,date:'',selected:null};w.count++;if(t.date>=w.date){w.date=t.date;w.selected=a.selected;}map.set(a.id,w);}return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date));}
 function stats(state,bank=null){const allowed=bank?new Set(bank.map(q=>q.id)):null;const answered=state.attempts.flatMap(t=>t.items).filter(i=>i.correct!==null&&(!allowed||allowed.has(i.id))),right=answered.filter(i=>i.correct).length;return {practiced:new Set(answered.map(a=>a.id)).size,rate:answered.length?Math.round(right/answered.length*100):null,wrong:wrongs(state).filter(w=>(!allowed||allowed.has(w.id))&&!state.reviewed[w.id]?.value).length,latest:state.attempts.length?score(state.attempts[state.attempts.length-1]):null};}
 const validDate=d=>typeof d==='string'&&Number.isFinite(Date.parse(d));
 function validate(data,bank){
  if(!data||data.version!==1||!Array.isArray(data.attempts)||!data.reviewed||typeof data.reviewed!=='object')throw Error('備份格式不符');
  const by=new Map(bank.map(q=>[q.id,q])),out=empty(),ids=new Set();
  for(const t of data.attempts){
   if(!t||typeof t.id!=='string'||!validDate(t.date)||!Array.isArray(t.items)||!t.items.length||ids.has(t.id))throw Error('測驗紀錄無效');ids.add(t.id);const seen=new Set();
   out.attempts.push({id:t.id,date:t.date,items:t.items.map(a=>{const q=by.get(a.id);if(!q||seen.has(a.id)||a.key!==q.answer||!(a.selected===null||['A','B','C','D'].includes(a.selected))||a.correct!==(a.selected===null?null:a.selected===q.answer))throw Error('作答紀錄無效');seen.add(a.id);return {id:a.id,selected:a.selected,key:a.key,correct:a.correct};})});
  }
  for(const [id,v] of Object.entries(data.reviewed)){if(!by.has(id)||typeof v?.value!=='boolean'||!validDate(v.at))throw Error('複習標記無效');out.reviewed[id]={value:v.value,at:v.at};}
  function validateQuiz(q){if(typeof q.id!=='string'||!Array.isArray(q.ids)||!q.ids.length||new Set(q.ids).size!==q.ids.length||q.ids.some(id=>!by.has(id))||!Number.isInteger(q.index)||q.index<0||q.index>=q.ids.length||!q.answers)throw Error('未交卷測驗無效');const answers={};for(const [id,a] of Object.entries(q.answers)){if(!q.ids.includes(id)||!['A','B','C','D'].includes(a))throw Error('未交卷答案無效');answers[id]=a;}return {id:q.id,ids:q.ids.slice(),index:q.index,answers};}
  if(data.active)out.active=validateQuiz(data.active);
  if(data.archivedQuizzes!==undefined){if(!Array.isArray(data.archivedQuizzes))throw Error('歷史進度格式無效');out.archivedQuizzes=data.archivedQuizzes.map(a=>{if(typeof a.reason!=='string'||!validDate(a.at))throw Error('歷史進度無效');return {quiz:validateQuiz(a.quiz),reason:a.reason,at:a.at};});}
  out.attempts.sort((a,b)=>a.date.localeCompare(b.date));return out;
 }
 function migrate(data,catalog,currentBank){const out=validate(data,catalog),ids=new Set(currentBank.map(q=>q.id));if(out.active&&out.active.ids.some(id=>!ids.has(id))){out.archivedQuizzes.push({quiz:out.active,reason:'考試範圍改為四單元；原未交卷進度完整保留，不再加入新測驗。',at:new Date().toISOString()});out.active=null;}return out;}
 function merge(a,b,bank){a=validate(a,bank);b=validate(b,bank);const map=new Map(a.attempts.map(t=>[t.id,t]));for(const t of b.attempts){if(map.has(t.id)&&JSON.stringify(map.get(t.id))!==JSON.stringify(t))throw Error('同場次紀錄衝突');map.set(t.id,t);}const out=empty();out.attempts=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));out.reviewed={...a.reviewed};for(const [id,v] of Object.entries(b.reviewed))if(!out.reviewed[id]||v.at>out.reviewed[id].at)out.reviewed[id]=v;const archives=new Map();for(const a0 of [...a.archivedQuizzes,...b.archivedQuizzes]){const prev=archives.get(a0.quiz.id);if(prev&&JSON.stringify(prev.quiz)!==JSON.stringify(a0.quiz))throw Error('保留進度衝突');if(!prev)archives.set(a0.quiz.id,a0);}out.active=a.active||b.active;if(a.active&&b.active&&a.active.id!==b.active.id&&!map.has(b.active.id))archives.set(b.active.id,{quiz:b.active,reason:'匯入另一場未交卷進度，保留原測驗並存檔另一場。',at:new Date().toISOString()});if(out.active&&map.has(out.active.id))out.active=null;out.archivedQuizzes=[...archives.values()];return out;}
 return {empty,pool,shuffle,grade,score,wrongs,stats,validate,merge,migrate};
});
