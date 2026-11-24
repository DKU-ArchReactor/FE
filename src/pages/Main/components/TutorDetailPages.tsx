import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import TutorDetailReader, {type ReadingSection} from './TutorDetailReader';
import './TutorDetailPages.css';

export type TutorDetailPage = ReadingSection;
type Detail = {context:string; pages:TutorDetailPage[]};
const DetailContext=createContext<((detail:Detail)=>void)|null>(null);

// This is a view inside the existing tutor panel, never a dialog or window overlay.
export function TutorDetailHost({children,inline=false,onOpen,label='튜터 자세히 보기'}:{children:ReactNode;inline?:boolean;onOpen?:()=>void;label?:string}) {
  const [detail,setDetail]=useState<Detail|null>(null);
  const windowRef=useRef<HTMLElement>(null);
  const returnFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(detail)windowRef.current?.focus();},[detail]);
  const close=()=>{setDetail(null);requestAnimationFrame(()=>{if(returnFocus.current?.isConnected)returnFocus.current.focus();});};
  return <DetailContext.Provider value={value=>{returnFocus.current=document.activeElement as HTMLElement|null;setDetail(value);onOpen?.();}}>
    <div className={`dev-tutor-host${inline?' dev-tutor-host-inline':''}`}>
      {children}
      {detail&&<section ref={windowRef} tabIndex={-1} className="ar-tutor dev-tutor-detail-window" aria-label={label} onKeyDown={event=>{if(event.key==='Escape')close();}}>
        <header className="dev-tutor-detail-bar">
          <code>{detail.context}</code>
        </header>
        <TutorDetailReader sections={detail.pages} documentKey={detail.context}/>
        <footer className="dev-tutor-detail-bottom"><button onClick={close}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6"/></svg><span>기본 해설로 돌아가기</span></button></footer>
      </section>}
    </div>
  </DetailContext.Provider>;
}

export default function TutorDetailPages({title,context,pages}:{title:string;context:string;pages:TutorDetailPage[]|(()=>TutorDetailPage[])}) {
  const open=useContext(DetailContext);
  return <button type="button" className="dev-tutor-detail-link" onClick={()=>open?.({context,pages:typeof pages==='function'?pages():pages})}>{title}<span aria-hidden="true">›</span></button>;
}
