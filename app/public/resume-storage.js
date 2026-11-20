import { id, keyFor, guestSession } from './profile-storage.js';

export async function originalStorage(action,value){
  const fileKey = id ? keyFor('original') : 'guest:' + guestSession + ':original';
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('commencely-original-resume',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  try{return await new Promise((resolve,reject)=>{
    const transaction=db.transaction('files',action==='get'?'readonly':'readwrite');
    const store=transaction.objectStore('files');
    const request=action==='get'?store.get(fileKey):action==='put'?store.put(value,fileKey):store.delete(fileKey);
    transaction.oncomplete=()=>resolve(request.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });}finally{db.close();}
}
