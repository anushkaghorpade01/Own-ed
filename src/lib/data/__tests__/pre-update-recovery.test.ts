import {it,expect} from 'vitest';
import 'fake-indexeddb/auto';
import {preservePreUpdateData,getRecoveryCopy,RECOVERY_KEY,RECOVERY_STORE,awaitRecoveryTransaction,recoveryBackup} from '../local/recovery';
import {idbDelete,saveAppDataPayload,STORE,getAppDataPayload} from '../local/db';
import {appStateToPayload} from '../local/app-state-bridge';
import {defaultAppState} from '@/lib/store/default-state';
it('captures exact original payload before writes and never replaces it on later loads',async()=>{await idbDelete(RECOVERY_STORE,RECOVERY_KEY);const before=appStateToPayload(defaultAppState());before.normalized.currentFinance={version:1,originalSentinel:'Keep original'} as never;await saveAppDataPayload(before);const copy=await preservePreUpdateData();expect(copy.payload).toEqual(before);const after=structuredClone(before);delete after.normalized.currentFinance;await saveAppDataPayload(after);await preservePreUpdateData();expect((await getRecoveryCopy())!.payload).toEqual(before);expect(await getAppDataPayload()).toEqual(after);expect(recoveryBackup(copy)!.data).toEqual(before.normalized);});

it('rejects a transaction abort instead of leaving the workspace loading forever',async()=>{const tx={error:new Error('quota abort'),oncomplete:null,onerror:null,onabort:null} as unknown as IDBTransaction;const result=awaitRecoveryTransaction(tx);tx.onabort!(new Event('abort') as never);await expect(result).rejects.toThrow('quota abort');});
it('keeps recovery when app data and metadata are cleared',async()=>{const {persistenceService}=await import('../local/persistence-service');const before=await preservePreUpdateData();await persistenceService.clearLocalData({includeAssets:false});expect(await getRecoveryCopy()).toEqual(before);});
