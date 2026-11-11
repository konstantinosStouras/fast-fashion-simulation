import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const script=readFileSync('theme.js','utf8');
test('theme follows system initially, persists an explicit choice and syncs between tabs',()=>{
 const dom=new JSDOM('<button id="theme-toggle">Theme</button>',{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
 let onSystem;w.matchMedia=()=>({matches:true,addEventListener:(_,fn)=>onSystem=fn});
 w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 assert.equal(w.document.documentElement.dataset.theme,'dark');
 const button=w.document.querySelector('button');assert.equal(button.getAttribute('aria-label'),'Switch to light theme');
 button.click();assert.equal(w.localStorage.getItem('ff:theme'),'light');assert.equal(w.document.documentElement.dataset.theme,'light');onSystem();assert.equal(w.document.documentElement.dataset.theme,'light');
 w.dispatchEvent(new w.StorageEvent('storage',{key:'ff:theme',newValue:'dark'}));assert.equal(w.document.documentElement.dataset.theme,'dark');
 w.close();
 const reload=new JSDOM('<button id="theme-toggle">Theme</button>',{url:'http://localhost/',runScripts:'outside-only'});reload.window.localStorage.setItem('ff:theme','dark');reload.window.eval(script);assert.equal(reload.window.document.documentElement.dataset.theme,'dark');reload.window.close();
});
test('blocked storage does not prevent switching themes',()=>{
 const dom=new JSDOM('<button id="theme-toggle">Theme</button>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.document.querySelector('button').click();assert.equal(w.document.documentElement.dataset.theme,'dark');w.close();
});
