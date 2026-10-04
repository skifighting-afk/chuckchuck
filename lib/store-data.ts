// 작업 087: 가게 데이터(stores.data JSON)의 서버 전용 칸 타입. 화면 상태(Team)에 서버만 쓰는 칸이 붙는다.
import type {Team} from './team-model';
export type Actor={id:string,name:string,email?:string};
export type AuditEntry={id:string,at:string,actor:Actor,action:string,target:string,before:unknown,after:unknown,reason:string};
export type Member={userId:string,employeeId:string};
export type Leave={id:string,employeeId:string,name:string,start:string,end:string,kind:'연차'|'무급휴가',days:number,reason:string,status:'승인 대기'|'승인'|'반려'|'취소',at:string,actor:string,reviewedAt?:string,reviewer?:string,comment?:string};
export type Notice={id:string,title:string,body:string,branchId:string,author:string,createdAt:string,reads:string[]};
export type ShiftSnap={id:string,date:string,start:string,end:string,employeeId:string,name:string};
export type Swap={id:string,kind:'대타'|'교대',branchId:string,shift:ShiftSnap,targetId:string|null,targetName:string,reason:string,status:'구하는 중'|'승인 대기'|'승인'|'반려'|'취소',at:string,by:string,taker?:{id:string,name:string,at:string},counter?:ShiftSnap|null,reviewedAt?:string,reviewer?:string,comment?:string};
export type Availability={slots:{weekday:number,start:string,end:string}[],note:string,updatedAt:string};
export type Operations={leaves:Leave[],notices:Notice[],swaps?:Swap[],availability?:Record<string,Availability>};
export type ManualStep={text:string,imageId?:string|null};
export type Manual={id:string,title:string,branchId:string,steps:ManualStep[],createdAt?:string,updatedAt:string,reads?:string[]};
export type PayrollRun={month:string,branch:string,locked:boolean,payDate?:string,rows:{employeeId:string,name:string,net:number,gross:number}[]};
export type JoinCode={branchId:string,code:string,legacyCode?:string,paused?:boolean,expiresAt?:string};
export type JoinApplication={id:string,userId:string,status:string,branchId:string,name:string,createdAt:string,[k:string]:any};
/** stores.data를 JSON.parse한 값 */
export type StoreData=Omit<Team,'payrollRuns'>&{payrollRuns:Record<string,PayrollRun>,_operations?:Operations,_members?:Member[],_manuals?:Manual[],_audit?:AuditEntry[],_account?:Record<string,any>,_hq?:Record<string,unknown>,_attendanceQr?:Record<string,string>,_attendanceQrMode?:Record<string,'static'|'dynamic'>,_joinCodes?:JoinCode[],_joinApplications?:JoinApplication[],_joinTerms?:any[]};
