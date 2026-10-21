import Script from 'next/script';

import { USAGE_OFF_KEY } from '@/lib/usage';

// How pages are used (clicks, scrolling, where people stop), seen through
// Microsoft Clarity. Switched on by NEXT_PUBLIC_CLARITY_PROJECT_ID; without it
// nothing loads, so development and CI never send anything.
//
// It runs without cookies: Clarity is told consent for storage is denied
// before it starts, so each page view stands alone and nothing follows a
// visitor between visits (the privacy policy's "no tracking cookies" holds).
// Every word on the page is masked (data-clarity-mask on <body>, in the
// layout), so a recording shows where people click and scroll, not what they
// read or wrote. A learner who has asked not to be counted is not recorded
// either: the study area remembers that on the device (UsageChoice).

const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();

export function UsageRecording() {
  if (!projectId || !/^[a-z0-9]{6,20}$/i.test(projectId)) return null;
  return (
    <Script id="usage-recording" strategy="lazyOnload">
      {`try{if(localStorage.getItem(${JSON.stringify(USAGE_OFF_KEY)})==='1')throw 0;` +
        // Clarity's own loader, as its setup page gives it.
        `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
        `t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;` +
        `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})` +
        `(window,document,"clarity","script",${JSON.stringify(projectId)});` +
        // Queued before Clarity has loaded, so it starts without cookies.
        `window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});` +
        `}catch(e){}`}
    </Script>
  );
}
