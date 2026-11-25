export function FitPalMark({ className = "h-8 w-8 rounded-[6px]" }: { className?: string }) {
  return (
    <div className={`${className} flex flex-shrink-0 items-center justify-center border border-hairline bg-wine-700`} aria-hidden="true">
      <svg className="h-4 w-4 text-cream-100" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.22 2.05c-.32-.23-.74-.23-1.06-.01C9.62 3.12 6.54 5.72 6.54 9.9c0 2.22.89 3.82 1.83 4.96.22.27.18.66-.08.88-.26.21-.65.18-.87-.09-1.12-1.35-2.08-3.21-2.08-5.75 0-.41-.42-.69-.8-.54C3.65 9.77 2 12.3 2 15.17 2 20.04 6.03 24 11 24c5.52 0 10-4.48 10-10 0-4.83-2.88-8.99-6.9-10.95-.38-.19-.83.05-.88.47-.11.96-.54 2.21-1.46 3.11-.27.26-.71.22-.92-.09-.2-.3-.15-.71.12-.96.9-1.03 1.26-2.31 1.26-3.53 0-.01 0 0 0 0z" />
      </svg>
    </div>
  );
}
