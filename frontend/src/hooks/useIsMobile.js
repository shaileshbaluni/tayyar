import { useEffect, useState } from 'react';

const MOBILE_MQ = '(max-width: 880px)';

/** Matches app sidebar / bottom-nav breakpoint. */
export function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    setMobile(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
