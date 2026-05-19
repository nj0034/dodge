import './styles.css';
import { mountApp } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#game');
const overlay = document.querySelector<HTMLElement>('#overlay');

if (!root || !canvas || !overlay) {
  throw new Error('Missing Dodge app mount elements');
}

mountApp({ root, canvas, overlay });
