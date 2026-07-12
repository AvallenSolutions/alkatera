import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Statement } from '@/components/studio/statement'
import { Eyebrow } from '@/components/studio/eyebrow'
import { PosterBlock } from '@/components/studio/poster-block'
import { PillButton } from '@/components/studio/pill-button'
import type { PartnerProfileConfig, PartnerCreditView } from '@/lib/partners/profiles'

/**
 * The one expert-partner profile surface, driven by a PartnerProfileConfig.
 *
 * Sections: the statement (name, category as mono meta), the room's one ochre
 * credit poster (Impact Focus only, from live PartnerCreditView), WHY WE
 * RECOMMEND THEM (prose), THE SERVICES (hairline rows grouped under mono
 * category eyebrows, no coloured icon grid), and GET IN TOUCH (website outline
 * pill + email room pill, ink on ochre).
 *
 * This is a plain component with no hooks, so a partner with no credit
 * programme can render it from a server component. The live credit is passed
 * in; the template never reads it directly.
 */
export function PartnerProfile({
  config,
  credit,
}: {
  config: PartnerProfileConfig
  credit?: PartnerCreditView
}) {
  const showCreditPoster =
    Boolean(config.creditProgramme) &&
    Boolean(credit?.eligibleForLadder) &&
    (credit?.status === 'pending' || credit?.status === 'available')

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <Link
        href="/expert-partners/"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All experts
      </Link>

      {/* Statement: the name, with the logo and category as quiet meta. */}
      <div className="flex items-start gap-5">
        <img
          src={config.logoSrc}
          alt={config.name}
          className={`h-16 w-16 shrink-0 rounded-md object-contain ${config.logoClassName}`}
        />
        <div className="min-w-0 space-y-3">
          <Statement eyebrow="THE NETWORK · EXPERTS" headline={`${config.name}.`} />
          <Eyebrow tone="dim">{config.category}</Eyebrow>
        </div>
      </div>

      {/* The room's one saturated block: the credit ladder (Impact Focus). */}
      {showCreditPoster && credit ? <CreditPoster credit={credit} /> : null}

      {/* Why we recommend them. */}
      <section className="space-y-4">
        <Eyebrow>Why we recommend them</Eyebrow>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {config.prose.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* The services: hairline rows grouped under mono category eyebrows. */}
      <section className="space-y-8">
        <Eyebrow>The services</Eyebrow>
        {config.serviceGroups.map((group) => (
          <div key={group.category} className="space-y-3">
            <Eyebrow tone="dim">{group.category}</Eyebrow>
            <ul className="divide-y divide-studio-hairline border-t border-studio-hairline">
              {group.services.map((service) => (
                <li key={service.title} className="py-4">
                  <p className="font-display text-sm font-semibold text-foreground">
                    {service.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Get in touch. */}
      <section className="space-y-4">
        <Eyebrow>Get in touch</Eyebrow>
        {!showCreditPoster && config.incentive ? (
          <p className="max-w-2xl text-sm leading-relaxed text-studio-dim">{config.incentive}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <PillButton href={config.website.url} variant="outline">
            {config.website.label}
          </PillButton>
          <PillButton href={config.email.mailto} variant="room">
            {config.email.label}
          </PillButton>
        </div>
      </section>
    </div>
  )
}

/** The £600 credit ladder as the page's one ochre poster (ink on ochre). */
function CreditPoster({ credit }: { credit: PartnerCreditView }) {
  const { creditAmount, monthsSubscribed, status } = credit

  if (status === 'available') {
    return (
      <PosterBlock
        on="ink"
        mark="square"
        eyebrow={`£${creditAmount} credit`}
        headline="Ready to redeem."
        note={`Contact Impact Focus to use your £${creditAmount} credit`}
      />
    )
  }

  const remaining = Math.max(0, 6 - monthsSubscribed)
  return (
    <PosterBlock
      on="ink"
      mark="square"
      eyebrow={`£${creditAmount} credit`}
      headline={`${monthsSubscribed} of 6 months.`}
      note={`Consulting credit building · ${remaining} ${remaining === 1 ? 'month' : 'months'} to go`}
    />
  )
}
