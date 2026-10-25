import {emptyState,State,validateState} from './domain';
const key='pond-companion-local-v1';
export async function load():Promise<State>{const raw=localStorage.getItem(key);return raw?validateState(JSON.parse(raw)):structuredClone(emptyState);}
export async function save(s:State){localStorage.setItem(key,JSON.stringify(s));}
