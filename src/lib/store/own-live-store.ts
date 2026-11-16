"use client";
import { useSyncExternalStore } from 'react';
import { DEFAULT_INPUTS, ModelInputs, validateInputs } from '@/lib/finance/own-live';
const KEY='owned:own-2028:live:v1';
type Snapshot={inputs:ModelInputs;revision:number;status:string;error:string};
const server:Snapshot={inputs:DEFAULT_INPUTS,revision:0,status:'Defaults loaded',error:''};
let snapshot=server,loaded=false;const listeners=new Set<()=>void>();const history:ModelInputs[]=[];
const emit=()=>listeners.forEach(fn=>fn());
function check(raw:unknown):ModelInputs{
 if(!raw||typeof raw!=='object')throw new Error('Invalid plan file.');
 const obj=raw as Record<string,unknown>;
 for(const [k,v] of Object.entries(DEFAULT_INPUTS)){
  if(!(k in obj))throw new Error(`Plan is missing ${k}.`);
  if(typeof v!=='object'&&typeof obj[k]!==typeof v)throw new Error(`Invalid ${k}.`);
 }
 if(!Array.isArray(obj.mix)||!Array.isArray(obj.frequency)||!Array.isArray(obj.seasonality)||!Array.isArray(obj.scenarios))throw new Error('Invalid plan arrays.');
 const x=obj as unknown as ModelInputs;const errors=validateInputs(x);if(errors.length)throw new Error(errors.join(' '));return x;
}
function load(){
 if(loaded||typeof window==='undefined')return;loaded=true;
 try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1)throw new Error('Unknown saved-plan version. Export your data before changing it.');snapshot={inputs:check(parsed.inputs),revision:1,status:'Saved on this device',error:''};}}
 catch(e){snapshot={...server,error:`Saved plan could not be read. It has not been overwritten. ${String(e)}`,status:'Saved plan needs attention'};}
 emit();
}
function subscribe(fn:()=>void){listeners.add(fn);load();return()=>{listeners.delete(fn);};}
export function setLiveInputs(next:ModelInputs){
 const errors=validateInputs(next);if(errors.length){snapshot={...snapshot,error:errors.join(' ')};emit();return false;}
 history.push(snapshot.inputs);if(history.length>30)history.shift();
 try{localStorage.setItem(KEY,JSON.stringify({version:1,savedAt:new Date().toISOString(),inputs:next}));snapshot={inputs:next,revision:snapshot.revision+1,status:'Saved on this device',error:''};}
 catch(e){snapshot={inputs:next,revision:snapshot.revision+1,status:'Not saved - export a backup',error:`Local save failed: ${String(e)}`};}
 emit();return true;
}
export function undoLive(){const prior=history.pop();if(!prior)return;const old=snapshot.inputs;setLiveInputs(prior);history.pop();void old;}
export function importLive(raw:string){const parsed=JSON.parse(raw);if(parsed.version!==1)throw new Error('Unsupported plan version.');return setLiveInputs(check(parsed.inputs));}
export function useOwnLive(){const state=useSyncExternalStore(subscribe,()=>snapshot,()=>server);return {...state,setInputs:setLiveInputs,undo:undoLive};}
