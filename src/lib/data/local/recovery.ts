/** First state seen by this update, preserved before financial migration writes.
 * Independent of cleared app data. Existing asset blobs are never copied or changed. */
import {openOwnedDb,STORE,APP_DATA_KEY,idbGet} from './db';
import type {LocalDbPayload,OwnedBackupV1} from '../types';
export const RECOVERY_KEY='before-owned-cohort-update-2026-11';
export const RECOVERY_STORE=STORE.uiPrefs;
export type RecoveryCopy={key:string;capturedAt:string;payload?:LocalDbPayload;legacyAppRaw:string|null;legacyFinanceRaw:string|null;legacyOwnedRaw?:string|null;legacySyncQueueRaw?:string|null};
export function awaitRecoveryTransaction(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();const fail=()=>reject(tx.error??new Error('Could not preserve the first saved state seen by this update. Editing remains blocked.'));tx.onerror=fail;tx.onabort=fail;});}
export async function preservePreUpdateData(){
 const old=await idbGet<RecoveryCopy>(RECOVERY_STORE,RECOVERY_KEY);if(old)return old;
 const raw=(key:string)=>typeof localStorage==='undefined'?null:localStorage.getItem(key);
 const copy:RecoveryCopy={key:RECOVERY_KEY,capturedAt:new Date().toISOString(),legacyAppRaw:raw('owned-app-state-v1'),legacyFinanceRaw:raw('owned:teacher-first:v1'),legacyOwnedRaw:raw('owned:own-2028:live:v1'),legacySyncQueueRaw:raw('owned-sync-queue-v1')};
 const db=await openOwnedDb(),tx=db.transaction([STORE.appData,RECOVERY_STORE],'readwrite'),done=awaitRecoveryTransaction(tx),store=tx.objectStore(RECOVERY_STORE);
 // Get current payload and add the first copy in the same transaction, including across tabs.
 const existing=store.get(RECOVERY_KEY);existing.onsuccess=()=>{if(existing.result)return;const current=tx.objectStore(STORE.appData).get(APP_DATA_KEY);current.onsuccess=()=>{copy.payload=current.result?.payload;store.add(copy);};};await done;
 return (await idbGet<RecoveryCopy>(RECOVERY_STORE,RECOVERY_KEY))!;
}
export async function getRecoveryCopy(){return idbGet<RecoveryCopy>(RECOVERY_STORE,RECOVERY_KEY);}
export function recoveryBackup(copy:RecoveryCopy):(OwnedBackupV1&{originalStorage:Omit<RecoveryCopy,'payload'|'key'>})|null{return copy.payload?{originalStorage:{capturedAt:copy.capturedAt,legacyAppRaw:copy.legacyAppRaw,legacyFinanceRaw:copy.legacyFinanceRaw,legacyOwnedRaw:copy.legacyOwnedRaw,legacySyncQueueRaw:copy.legacySyncQueueRaw},schemaVersion:1,exportedAt:copy.capturedAt,appVersion:'first-state-seen-by-cohort-update',data:copy.payload.normalized,extensions:copy.payload.extensions,assetMetadata:[]}:null;}
