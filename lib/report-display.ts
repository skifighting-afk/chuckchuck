type TrendRow={employeeId:string;gross:number;hours:number};
/** Read-only projection. A confirmed zero is different from an absent record. */
export function payrollTrendPoint(month:string,rows:TrendRow[],locked:boolean,hasRecords:boolean){
 const relevant=locked?rows:rows.filter(r=>r.hours!==0||r.gross!==0);
 const gross=relevant.reduce((n,r)=>n+r.gross,0),hours=relevant.reduce((n,r)=>n+r.hours,0);
 const hasData=locked||hasRecords||relevant.length>0;
 return {month,gross,hours,staff:new Set(relevant.map(r=>r.employeeId)).size,hasData,status:!hasData?'기록 없음':locked?'확정 급여':'예상 급여'};
}
