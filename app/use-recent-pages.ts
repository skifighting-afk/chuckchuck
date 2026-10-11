import {useEffect,useState} from 'react';
import {recordVisitedPage} from '../lib/task-navigation';
// The owner shell stays mounted while the mobile drawer is closed.
export function useRecentPages(scope:string,page:string,allowed:readonly string[]){
 const [value,setValue]=useState<{scope:string;pages:string[]}>({scope:'',pages:[]});
 useEffect(()=>{let pages:string[]=[];try{pages=recordVisitedPage(localStorage,scope,page,allowed)}catch{}setValue({scope,pages})},[scope,page]);
 return value.scope===scope?value.pages:[];
}
