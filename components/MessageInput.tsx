'use client';
import { useRef, useState } from 'react';

interface Props {
  onSend: (content: string) => void;
}

export default function MessageInput({ onSend }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    if (ref.current) {
      ref.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    // auto-grow textarea
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + 'px';
    }
  }

  return (
    <div
      className="flex items-end gap-2 rounded-lg px-4 py-3"
      style={{ background: 'var(--dc-input-bg)' }}
    >
      <textarea
        ref={ref}
        className="flex-1 bg-transparent resize-none outline-none text-sm leading-6"
        style={{
          color: 'var(--dc-text)',
          maxHeight: 200,
          height: 24,
          overflowY: 'auto',
        }}
        placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        rows={1}
      />
      <button
        onClick={submit}
        className="flex-shrink-0 rounded px-3 py-1 text-xs font-medium transition-colors"
        style={{ background: 'var(--dc-accent)', color: 'white' }}
      >
        Send
      </button>
    </div>
  );
}
