/** Preserve small trackpad movements; limit large wheel notches to a few lines. */
export function tutorWheelDistance(delta:number,mode:number,height:number,lineHeight=24){
  const pixels=delta*(mode===1?lineHeight:mode===2?height:1);
  if(mode===0&&Math.abs(pixels)<40)return pixels;
  return Math.sign(pixels)*Math.min(Math.abs(pixels)*0.65,64);
}

export function scrollTutorWheel(event:WheelEvent,root:HTMLElement){
  if(event.defaultPrevented||!event.cancelable||event.ctrlKey||event.metaKey||event.shiftKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  if(!(event.target instanceof Element))return;
  for(let element:Element|null=event.target;element&&root.contains(element);element=element.parentElement){
    if(!(element instanceof HTMLElement))continue;
    const style=getComputedStyle(element);
    if(!/^(auto|scroll)$/.test(style.overflowY)||element.scrollHeight<=element.clientHeight)continue;
    const delta=tutorWheelDistance(event.deltaY,event.deltaMode,element.clientHeight,Number.parseFloat(style.lineHeight)||24);
    if(delta<0&&element.scrollTop<=0||delta>0&&element.scrollTop>=element.scrollHeight-element.clientHeight)return;
    event.preventDefault();
    element.scrollTop+=delta;
    return;
  }
}
