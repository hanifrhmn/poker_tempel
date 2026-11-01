import { useState } from 'react';
import { copyText, roomLink } from '../lib/format.js';

export default function CopyLinkButton({ code, label = 'Copy invite link', className = '' }) {
  const [status, setStatus] = useState('idle');

  const copy = async () => {
    const copied = await copyText(roomLink(code));
    setStatus(copied ? 'copied' : 'failed');
    setTimeout(() => setStatus('idle'), 1500);
  };

  return (
    <button type="button" onClick={copy} className={className}>
      {status === 'copied' ? 'Link copied' : status === 'failed' ? 'Copy failed' : label}
    </button>
  );
}
