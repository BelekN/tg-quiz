/** Цитата-реплика, которую разбирают в упражнении. */
export default function Quote({ children }) {
  return (
    <blockquote className="rounded-2xl border-l-4 border-tg-accent bg-tg-section px-4 py-3.5 text-[16px] leading-snug whitespace-pre-line">
      {children}
    </blockquote>
  )
}
