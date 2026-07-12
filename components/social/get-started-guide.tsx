import { Eyebrow } from '@/components/studio/eyebrow';
import { PillButton } from '@/components/studio/pill-button';

export interface GetStartedAction {
  label: string;
  href: string;
}

interface GetStartedGuideProps {
  description: string;
  actions: GetStartedAction[];
}

/**
 * The empty-state guide: a dim line and a row of pills, not a dashed box.
 */
export function GetStartedGuide({ description, actions }: GetStartedGuideProps) {
  return (
    <section className="border-t border-studio-hairline pt-5">
      <Eyebrow tone="dim">GET STARTED</Eyebrow>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <PillButton key={`${action.href}-${action.label}`} href={action.href} variant="outline" size="sm">
            {action.label}
          </PillButton>
        ))}
      </div>
    </section>
  );
}
