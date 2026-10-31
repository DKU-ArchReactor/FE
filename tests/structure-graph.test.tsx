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
