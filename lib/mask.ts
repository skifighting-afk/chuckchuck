// 작업 079: 직원 목록에서 연락처·이메일·주소 가리기(누르면 보기)
export const maskPhone=(v:string)=>{const d=v.replace(/\D/g,'');if(d.length<7)return v?'•'.repeat(Math.min(8,v.length)):'';return d.slice(0,3)+'-****-'+d.slice(-4)};
export const maskEmail=(v:string)=>{const [u,dom]=v.split('@');if(!dom)return v?'•••':'';return (u.slice(0,1)||'')+'•••@'+dom};
export const maskAddress=(v:string)=>{const p=v.trim().split(/\s+/);return p.length<=2?(v?'•••':''):p.slice(0,2).join(' ')+' •••'};
