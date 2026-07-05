import {
  BigNumber,
  BreathingGrid,
  Eyebrow,
  FactRow,
  InkBand,
  Panel,
  PillButton,
  PosterBlock,
  ROOMS,
  RoomBand,
  StageBar,
  StateChip,
  Statement,
  STUDIO,
  StudioShell,
} from '@/components/studio';

/**
 * TEMPORARY kit gallery: every studio primitive on one surface, in the
 * portfolio room's colour. Deleted before the redesign ships.
 */
export default function StudioGalleryPage() {
  const room = ROOMS.portfolio;

  return (
    <StudioShell
      room={room}
      mark={room.mark}
      band={
        <RoomBand
          room={room}
          tabs={[
            { label: 'Gallery', href: '/distributor/dev/studio' },
            { label: 'Brands', href: '/distributor/brands' },
            { label: 'Matches', href: '/distributor/brands/pending-matches' },
          ]}
          note="KIT · V1 · JULY 2026"
        />
      }
      inkBand={
        <InkBand
          action={
            <PillButton variant="room" size="sm">
              Upload a list
            </PillButton>
          }
          tabs={[{ label: 'Gallery', href: '/distributor/dev/studio' }]}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">
            The kit of parts.
          </span>
        </InkBand>
      }
    >
      <div>
        <Statement eyebrow="THE STUDIO · KIT GALLERY" headline="The kit of parts.">
          <BigNumber value="16" label="PRIMITIVES" size="display" />
          <BigNumber value="94" label="NEED ATTENTION" tone="attention" size="display" />
        </Statement>

        <div className="mt-12 space-y-12">
          {/* Poster blocks in a breathing grid */}
          <section>
            <Eyebrow tone="dim" className="mb-4">
              POSTER BLOCKS · THE BREATHING GRID
            </Eyebrow>
            <BreathingGrid className="md:grid-cols-4">
              <PosterBlock
                eyebrow="PORTFOLIO"
                headline="214 brands in the book."
                note="3 CONFLICTS."
                colour={STUDIO.forest}
                mark="circle"
                href="/distributor/dev/studio"
              />
              <PosterBlock
                eyebrow="SUPPLY"
                headline="Find what's missing."
                note="2 LISTS THIS WEEK."
                colour={STUDIO.cobalt}
                mark="triangle"
                href="/distributor/dev/studio"
              />
              <PosterBlock
                eyebrow="POST"
                headline="12 await approval."
                note="4 REPLIES."
                colour={STUDIO.ochre}
                on="ink"
                mark="square"
                href="/distributor/dev/studio"
              />
              <PosterBlock
                eyebrow="EVIDENCE"
                headline="Counsel & craft."
                note="LAST EXPORT 3 JULY."
                colour={STUDIO.brick}
                mark="quarter"
                href="/distributor/dev/studio"
              />
            </BreathingGrid>
          </section>

          {/* Panels, numbers, facts */}
          <section className="grid gap-4 md:grid-cols-3">
            <Panel>
              <Eyebrow className="mb-4">THE BIG NUMBER</Eyebrow>
              <div className="flex items-end gap-8">
                <BigNumber value="58" label="IN PLAY" />
                <BigNumber value="82%" label="SKUS RATED" tone="room" />
                <BigNumber value="7" label="STALE" tone="stale" />
              </div>
            </Panel>
            <Panel>
              <Eyebrow className="mb-4">STATE CHIPS · MONO, NO PILLS</Eyebrow>
              <div className="flex flex-wrap items-center gap-4">
                <StateChip tone="good">Responded</StateChip>
                <StateChip tone="attention">Overdue</StateChip>
                <StateChip tone="stale">Stale 113D</StateChip>
                <StateChip tone="hold">On hold</StateChip>
                <StateChip>Quiet</StateChip>
              </div>
              <Eyebrow className="mb-3 mt-6">STAGE BAR · OPACITY = WEIGHT</Eyebrow>
              <StageBar
                showValues
                segments={[
                  { label: 'Unrated', value: 41 },
                  { label: 'Bronze', value: 68 },
                  { label: 'Silver', value: 55 },
                  { label: 'Gold', value: 38 },
                  { label: 'Platinum', value: 12 },
                ]}
              />
            </Panel>
            <Panel>
              <Eyebrow className="mb-1">FACT ROWS · REVEAL ON APPROACH</Eyebrow>
              <FactRow subject="Nc'nean Distillery" detail="follow-up drafted" meta="SCORE 72" />
              <FactRow subject="Cooper King demo" detail="prep block at 13:45" meta="14:00" />
              <FactRow subject="Ramborn Cider Co." detail="conflict on organic claim" meta="2D AGO" />
            </Panel>
          </section>

          {/* Actions */}
          <section>
            <Eyebrow tone="dim" className="mb-4">
              ACTIONS · PILLS, RADIUS FULL
            </Eyebrow>
            <div className="flex flex-wrap items-center gap-3">
              <PillButton>Add brand</PillButton>
              <PillButton variant="outline">Sync</PillButton>
              <PillButton variant="room">Review & send</PillButton>
              <PillButton variant="ghost">Ghost action</PillButton>
              <PillButton size="sm">Small ink</PillButton>
            </div>
          </section>

          {/* Palette */}
          <section>
            <Eyebrow tone="dim" className="mb-4">
              THE PALETTE · GALLERY GREY, FOUR INKS
            </Eyebrow>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {(
                [
                  ['PAPER', STUDIO.paper, true],
                  ['CREAM', STUDIO.cream, true],
                  ['HAIRLINE', STUDIO.hairline, true],
                  ['DIM', STUDIO.dim, false],
                  ['INK', STUDIO.ink, false],
                  ['FOREST', STUDIO.forest, false],
                  ['COBALT', STUDIO.cobalt, false],
                  ['OCHRE', STUDIO.ochre, true],
                  ['BRICK', STUDIO.brick, false],
                  ['OCHRE INK', STUDIO.ochreInk, false],
                ] as const
              ).map(([name, hex, darkText]) => (
                <div
                  key={name}
                  className="rounded-[6px] border border-studio-hairline p-4"
                  style={{ backgroundColor: hex, color: darkText ? STUDIO.ink : STUDIO.cream }}
                >
                  <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">
                    {name}
                  </div>
                  <div className="mt-6 font-mono text-[10px] opacity-80">{hex}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </StudioShell>
  );
}
