'use client'
import React, { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

// How a modal leaves: 'dismiss' sinks away (cancel, Esc, backdrop), 'saved' lifts off after a successful save
export type ModalExit = 'dismiss' | 'saved'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Render while the modal should exist. Set `closing` to play the exit animation;
 * `onExited` fires when it finishes, and the parent then unmounts the modal.
 */
export default function Modal({ title, closing, onDismiss, onExited, size = 'md', children }: {
  title: string
  closing: ModalExit | null
  onDismiss: () => void
  onExited: () => void
  size?: 'sm' | 'md'
  children: React.ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2)}`).current
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  // Focus the first field, keep Tab inside, lock page scroll; restore everything on close
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus({ preventScroll: true })
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); dismissRef.current(); return }
      if (e.key !== 'Tab' || !dialog) return
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null)
      if (!items.length) return
      const firstEl = items[0], lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      returnTo?.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div
      className={`md-backdrop${closing ? ` closing ${closing}` : ''}`}
      onMouseDown={e => { if (e.target === e.currentTarget && !closing) onDismiss() }}
    >
      <style>{`
        .md-backdrop {
          position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1rem;
          background: rgba(20,14,6,0.5); backdrop-filter: blur(3px); animation: mdFadeIn 0.25s ease both;
        }
        .md-backdrop.closing.dismiss { animation: mdFadeOut 0.26s ease both; }
        .md-backdrop.closing.saved { animation: mdFadeOut 0.46s ease both; }
        .md-dialog {
          position: relative; width: 100%; max-height: calc(100vh - 2rem); overflow-y: auto;
          background: var(--surface); border: 1px solid var(--border); border-radius: 18px;
          box-shadow: 0 24px 64px rgba(20,14,6,0.35); padding: 1.5rem 1.5rem 1.25rem;
          animation: mdPop 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both;
        }
        .md-dialog.md { max-width: 560px; }
        .md-dialog.sm { max-width: 440px; }
        .md-backdrop.closing.dismiss .md-dialog { animation: mdDismiss 0.24s cubic-bezier(0.4, 0, 1, 1) both; }
        .md-backdrop.closing.saved .md-dialog { animation: mdSaved 0.46s cubic-bezier(0.5, 0, 0.75, 0) both; }
        .md-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 1.25rem; }
        .md-title { font-family: 'Lora', serif; font-size: 19px; font-weight: 600; color: var(--text); }
        .md-close {
          width: 34px; height: 34px; border-radius: 9px; border: 1px solid transparent; background: none; flex-shrink: 0;
          color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;
          transition: background 0.15s, color 0.15s;
        }
        .md-close:hover { background: var(--surface2); color: var(--text); }
        @keyframes mdFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mdFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes mdPop     { from { opacity: 0; transform: translateY(18px) scale(0.94); } to { opacity: 1; transform: none; } }
        @keyframes mdDismiss { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(12px) scale(0.96); } }
        @keyframes mdSaved   { 0% { opacity: 1; transform: none; } 25% { opacity: 1; transform: scale(1.015); } 100% { opacity: 0; transform: translateY(-48px) scale(0.92); } }

        @media (max-width: 768px) {
          .md-backdrop { align-items: flex-end; padding: 0; }
          .md-dialog { border-radius: 20px 20px 0 0; max-height: 92vh; animation-name: mdSheetUp; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); }
          .md-backdrop.closing.dismiss .md-dialog { animation-name: mdSheetDown; }
          @keyframes mdSheetUp   { from { transform: translateY(100%); } to { transform: none; } }
          @keyframes mdSheetDown { from { transform: none; } to { transform: translateY(100%); } }
        }
        @media (prefers-reduced-motion: reduce) {
          .md-backdrop, .md-dialog, .md-backdrop.closing .md-dialog { animation-duration: 0.01s !important; }
        }
      `}</style>
      <div
        ref={dialogRef}
        className={`md-dialog ${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onAnimationEnd={e => { if (e.target === e.currentTarget && closing) onExited() }}
      >
        <div className="md-head">
          <h2 id={titleId} className="md-title">{title}</h2>
          <button type="button" className="md-close" onClick={onDismiss} aria-label="Close dialog"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
