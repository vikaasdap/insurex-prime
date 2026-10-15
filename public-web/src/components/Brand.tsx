/** The product wordmark: InsuroX, a big red centred dot, Prime. The dot matches the text's size and weight. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={className}>
      InsuroX
      <span aria-hidden="true" className="mx-[0.05em] text-red-500">
        •
      </span>
      <span className="sr-only">.</span>Prime
    </span>
  );
}
