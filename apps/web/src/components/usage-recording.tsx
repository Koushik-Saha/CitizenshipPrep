import { USAGE_OFF_KEY } from '@/lib/usage';

// How pages are used (clicks, scrolling, where people stop), seen through
// Microsoft Clarity. Switched on by NEXT_PUBLIC_CLARITY_PROJECT_ID; without it
// nothing is rendered, so development and CI never send anything.
//
// It runs without cookies: Clarity is told consent for storage is denied
// before it starts, so each page view stands alone and nothing follows a
// visitor between visits (the privacy policy's "no tracking cookies" holds).
// Every word on the page is masked (data-clarity-mask on <body>, in the
// layout), so a recording shows where people click and scroll, not what they
// read or wrote. A learner who has asked not to be counted is not recorded
// either: the study area remembers that on the device (UsageChoice).
//
// A plain inline script, not next/script: that component's code would be in
// every page's JavaScript, Clarity or not. This one waits for the page to
// have loaded, then for the browser to be idle, before fetching Clarity.

const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();

const loader = (id: string) =>
  `(function(){` +
  `function go(){try{if(localStorage.getItem(${JSON.stringify(USAGE_OFF_KEY)})==='1')return;}catch(e){}` +
  // Clarity's own loader, as its setup page gives it.
  `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
  `t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;` +
  `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})` +
  `(window,document,"clarity","script",${JSON.stringify(id)});` +
  // Queued before Clarity has loaded, so it starts without cookies.
  `window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});}` +
  `function later(){(window.requestIdleCallback||setTimeout)(go);}` +
  `if(document.readyState==='complete')later();else addEventListener('load',later);` +
  `})();`;

export function UsageRecording() {
  if (!projectId || !/^[a-z0-9]{6,20}$/i.test(projectId)) return null;
  return <script id="usage-recording" dangerouslySetInnerHTML={{ __html: loader(projectId) }} />;
}
