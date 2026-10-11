export function managerPermissions(data:any,self:any,now=Date.now()){
 const dg=data.settings?.delegate,today=new Date(now+9*3600000).toISOString().slice(0,10);
 const acting=!!dg&&dg.employeeId===self.id&&typeof dg.until==='string'&&dg.until>=today;
 return {acting:acting?dg.until:null,permissions:[...new Set<string>([...(self.managerPermissions||[]),...(acting?['schedule','attendance','leave','notices']:[])])]};
}
