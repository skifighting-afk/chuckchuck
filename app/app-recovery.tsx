import {Component,type ReactNode} from 'react';

/** A failed lazy chunk must leave a usable recovery action instead of a blank workspace. */
export class AppRecovery extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<main className="app-recovery" role="alert"><h1>화면을 다시 불러와 주세요.</h1><p>새 버전으로 바뀌었거나 연결이 잠시 끊겼어요. 서버에 저장된 기록은 그대로 보관돼요.</p><p>아직 저장하지 않은 입력이 있다면 다시 확인해 주세요.</p><button type="button" onClick={()=>location.reload()}>화면 다시 불러오기</button><a href="/status">서비스 상태 확인</a></main>:this.props.children}
}
