import type {ReadingSection} from '../components/TutorDetailReader';
import {tutorDecimalText,tutorReadingText} from './tutorReadable';

/** Keep a topic intact instead of splitting its text to fit the panel height. */
export function tutorSectionPages(sections:ReadingSection[]):ReadingSection[]{
  return sections.map(section=>({title:tutorDecimalText(section.title),blocks:section.blocks.map(block=>({...block,label:block.label?tutorDecimalText(block.label):undefined,text:tutorReadingText(block.text)})).filter(block=>block.text)})).filter(section=>section.blocks.length);
}
