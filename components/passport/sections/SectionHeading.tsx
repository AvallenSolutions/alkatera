interface SectionHeadingProps {
  children: React.ReactNode;
  number: string;
  variant?: 'light' | 'dark';
}

export default function SectionHeading({ children, number, variant = 'light' }: SectionHeadingProps) {
  const isDark = variant === 'dark';

  return (
    <div className={`flex items-baseline gap-4 mb-8 md:mb-12 border-b pb-4 ${isDark ? 'border-stone-700' : 'border-stone-200'}`}>
      <span className={`font-mono text-sm font-bold tracking-widest ${isDark ? 'text-brand-accent' : 'text-lime-800'}`}>
        {number}
      </span>
      <h2 className={`font-serif text-3xl md:text-5xl ${isDark ? 'text-white' : 'text-stone-900'}`}>
        {children}
      </h2>
    </div>
  );
}
