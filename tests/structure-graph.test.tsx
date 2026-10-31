import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import StructureGraph from '../src/pages/CToAsm/StructureGraph';
afterEach(cleanup);
it('keeps cycles explicit and lets keyboard users navigate to the actual source line', () => {
  const select=vi.fn();
  render(<StructureGraph nodes={[{id:'a',title:'head',line:7,fields:[{name:'next',value:'tail'}]},{id:'b',title:'tail',line:9,fields:[{name:'next',value:'head'}]}]} edges={[{from:'a',to:'b',label:'next'},{from:'b',to:'a',label:'next'}]} onSelectLine={select} />);
  expect(screen.getAllByRole('button').length).toBe(2);
  fireEvent.keyDown(screen.getByRole('button',{name:'head, C 7행'}),{key:'Enter'});
  expect(select).toHaveBeenCalledWith(7);
});
it('lays out a tree parent above its ordered left and right children', () => {
  const select=vi.fn();
  const nodes=[
    {id:'left',title:'left',line:2,fields:[{name:'value',value:'10'}]},
    {id:'right',title:'right',line:3,fields:[{name:'value',value:'30'}]},
    {id:'root',title:'root',line:1,fields:[{name:'left',value:'left'},{name:'right',value:'right'}]},
  ];
  const {container}=render(<StructureGraph nodes={nodes} edges={[{from:'root',to:'left',label:'left'},{from:'root',to:'right',label:'right'}]} shape="tree" onSelectLine={select} />);
  const position=(name:string)=>{
    const transform=screen.getByRole('button',{name:`${name}, C ${name==='root'?'1':name==='left'?'2':'3'}행`}).getAttribute('transform')!;
    return transform.match(/translate\(([-\d.]+),([-\d.]+)\)/)!.slice(1).map(Number);
  };
  const [rootX,rootY]=position('root'), [leftX,leftY]=position('left'), [rightX,rightY]=position('right');
  expect(rootY).toBeLessThan(leftY);
  expect(rootY).toBeLessThan(rightY);
  expect(leftX).toBeLessThan(rootX);
  expect(rootX).toBeLessThan(rightX);
  expect(container.querySelectorAll('path[marker-end]').length).toBe(2);
});
it('does not draw a pointer to a node before that edge is recorded', () => {
  const {container}=render(<StructureGraph nodes={[{id:'root',title:'root',line:1,fields:[]},{id:'child',title:'child',line:2,fields:[]}]} edges={[]} shape="tree" onSelectLine={vi.fn()} />);
  expect(container.querySelectorAll('path[marker-end]')).toHaveLength(0);
});
