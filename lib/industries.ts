export const industries=[{id:'restaurant',name:'음식점',icon:'🍚'},{id:'cafe',name:'카페·베이커리',icon:'☕'},{id:'retail',name:'편의점·판매점',icon:'🛍️'},{id:'beauty',name:'미용·뷰티',icon:'✂️'},{id:'fitness',name:'운동·레저',icon:'🏃'},{id:'education',name:'학원·교육',icon:'📚'},{id:'lodging',name:'숙박',icon:'🏠'},{id:'other',name:'그 밖의 업종',icon:'✨'}] as const;
export type IndustryId=typeof industries[number]['id'];
export const isIndustry=(v:unknown):v is IndustryId=>industries.some(i=>i.id===v);
export const industryName=(v:unknown)=>industries.find(i=>i.id===v)?.name||'미선택';
