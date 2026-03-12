import React from 'react';
import { useApp } from '../context/AppContext';

export default function Toast() {
  const { notification } = useApp();
  if (!notification) return null;

  const colors = {
    success: { bg: '#06D6A0', text: '#080C18' },
    error: { bg: '#FF6B6B', text: '#fff' },
    info: { bg: '#4CC9F0', text: '#080C18' },
  };
  const c = colors[notification.type] || colors.success;

  return (
    <div
      className="fixed top-4 left-1/2 z-50 px-5 py-3 rounded-2xl font-medium text-sm shadow-lg"
      style={{
        background: c.bg,
        color: c.text,
        transform: 'translateX(-50%)',
        animation: 'fadeUp 0.3s ease-out',
        maxWidth: '320px',
        textAlign: 'center',
      }}
    >
      {notification.msg}
    </div>
  );
}
