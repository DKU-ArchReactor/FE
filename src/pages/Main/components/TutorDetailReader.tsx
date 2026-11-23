import { useLayoutEffect, useRef, useState } from "react";

export type ReadingSection = { title: string; blocks: { label?: string; text: string; href?:string }[] };

/** Pages contain complete reading units; arrows never scroll the viewport. */
export default function TutorReader({ sections, documentKey }: { sections: ReadingSection[]; documentKey: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<ReadingSection[]>([]);
  const [selection, setSelection] = useState({ key: documentKey, index: 0 });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let active=true;
    const paginate = () => {
      if(!active)return;
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || height < 24) return;
      const measure = document.createElement('div');
      measure.className = 'tutor-reading-block';
      Object.assign(measure.style, { position: 'fixed', visibility: 'hidden', width: `${width}px`, pointerEvents: 'none', top: '0', left: '-10000px' });
      element.append(measure);
      const size = (text: string, label?: string) => {
        measure.replaceChildren();
        if (label) { const caption=document.createElement('strong');caption.textContent=label;measure.append(caption); }
        const paragraph=document.createElement('p');paragraph.textContent=text;measure.append(paragraph);
        return measure.getBoundingClientRect().height + (Number.parseFloat(getComputedStyle(measure).marginBottom)||0);
      };
      const result: ReadingSection[] = [];
      for (const section of sections) {
        let page: ReadingSection = { title: section.title, blocks: [] };
        let used=0;
        for (const block of section.blocks) {
          let text=block.text.trim();
          if (!text) continue;
          while (text) {
            const fullHeight=size(text,block.label);
            if (used+fullHeight<=height) {page.blocks.push({...block,text});used+=fullHeight;break;}
            if (page.blocks.length) { result.push(page);page={title:section.title,blocks:[]};used=0;continue; }
            // A temporarily collapsed panel cannot fit even one labelled line.
            // Keep the paragraph intact until ResizeObserver sees its final height.
            if(size(text.slice(0,1),block.label)>height){page.blocks.push({...block,text});break;}
            let low=1,high=text.length;
            while(low<high){const middle=Math.ceil((low+high)/2);if(size(text.slice(0,middle),block.label)<=height)low=middle;else high=middle-1;}
            // Prefer a nearby sentence or word boundary without dropping text.
            const prefix=text.slice(0,low);
            const boundary=Math.max(prefix.lastIndexOf('. ')+1,prefix.lastIndexOf(' '));
            const end=boundary>low*.7 ? boundary : low;
            page.blocks.push({...block,text:text.slice(0,end)});result.push(page);
            page={title:section.title,blocks:[]};used=0;text=text.slice(end).trimStart();
          }
        }
        if(page.blocks.length)result.push(page);
      }
      measure.remove();
      setPages(result);
    };
    const resize=new ResizeObserver(paginate);resize.observe(element);paginate();
    void document.fonts.ready.then(paginate);
    return ()=>{active=false;resize.disconnect();};
  },[sections]);
  const index=selection.key===documentKey ? Math.min(selection.index,Math.max(0,pages.length-1)) : 0;
  const page=pages[index];
  const topicPages=pages.map((_,i)=>i);
  const topicIndex=topicPages.indexOf(index);
  const move=(direction:number)=>{
    viewport.current?.parentElement?.focus({preventScroll:true});
    setSelection({key:documentKey,index:topicPages[Math.max(0,Math.min(topicPages.length-1,topicIndex+direction))]??index});
  };
  return <section className="tutor-reader" aria-label="튜터 읽기" tabIndex={0} onKeyDown={event=>{
    if(event.target!==event.currentTarget)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}
  }}>
    <header><h3>{page?.title ?? sections[0]?.title}</h3><span aria-live="polite">{topicPages.length>1 ? `${topicIndex+1} / ${topicPages.length}` : ''}</span></header>
    <div ref={viewport} className="tutor-reader-viewport">
      {page?.blocks.map((block,i)=><div className="tutor-reading-block" key={`${index}-${i}`}>{block.label&&<strong>{block.label}</strong>}<p>{block.href?.startsWith('https://')?<a href={block.href} target="_blank" rel="noopener noreferrer">{block.text}</a>:block.text}</p></div>)}
    </div>
    {topicPages.length>1 && <nav aria-label="설명 페이지 이동" className="tutor-reader-arrows">
      <button aria-label="이전 설명" disabled={topicIndex===0} onClick={()=>move(-1)}>‹</button>
      <button aria-label="다음 설명" disabled={topicIndex===topicPages.length-1} onClick={()=>move(1)}>›</button>
    </nav>}
  </section>;
}
