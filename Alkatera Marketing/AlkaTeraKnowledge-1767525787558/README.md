# AlkaTera Knowledge Stream

A discovery-driven content hub with a parallax stream layout.

## Features

- **Stream Layout**: A 3-column masonry grid where columns scroll at different speeds (parallax), creating a fluid, floating feel.
- **Content Types**:
    - **Articles**: Text-heavy cards with elegant typography and hover effects.
    - **Videos**: Visual cards with custom play buttons and image overlays.
    - **Quotes**: Bold, colored blocks (`#ccff00`) that break up the rhythm.
- **Floating Filters**: Sticky filter bubbles that allow quick resorting of the stream.
- **Ambience**: Subtle noise textures and blurred color orbs in the background maintain the "Digital Twin" aesthetic.

## Dependencies

- framer-motion
- lucide-react
- clsx
- tailwind-merge

## Usage

```tsx
import { AlkaTeraKnowledge } from '@/sd-components/ccc138a6-5c8d-4ccb-8abc-c1304ab13ce7';

function Page() {
  return <AlkaTeraKnowledge />;
}
```
