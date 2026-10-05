// 가이드 13·93: 운영자 정보(화면 아래). 약관 본문과 따로 둬서 첫 화면에 약관 글을 싣지 않는다.
import {OPERATOR,operatorLines,ftcLink} from '../lib/operator';
export function OperatorInfo(){
 const link=ftcLink(OPERATOR.bizNo);
 return <dl className="operator-info">{operatorLines().map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}{link&&<div><dt>사업자 정보</dt><dd><a href={link} target="_blank" rel="noopener">공정거래위원회에서 확인</a></dd></div>}</dl>;
}
export function OperatorFooter(){
 const l=Object.fromEntries(operatorLines()),link=ftcLink(OPERATOR.bizNo);
 return <div className="saas-footer-operator"><p>{OPERATOR.service} · 상호 {l['상호']} · 대표자 {l['대표자']} · 사업자등록번호 {l['사업자등록번호']}{link&&<> (<a href={link} target="_blank" rel="noopener">사업자 정보 확인</a>)</>}</p><p>통신판매업 신고번호 {l['통신판매업 신고번호']} · 주소 {l['주소']} · 전화 {l['전화']} · 이메일 {l['이메일']}</p><p>개인정보 보호책임자 {l['개인정보 보호책임자']} · 호스팅 제공자 {l['호스팅 제공자']}</p><p><a className="footer-insta" href="https://www.instagram.com/chukchukbot_official/" target="_blank" rel="noopener">인스타그램 @chukchukbot_official</a></p></div>;
}
