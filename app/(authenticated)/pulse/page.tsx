import { Metadata } from 'next';
import { PulseShell } from '@/components/pulse/PulseShell';

export const metadata: Metadata = {
  title: 'Pulse — alkatera',
  description: 'Your sustainability, live. A continuously updating view of your impact.',
};

export default function PulsePage() {
  return <PulseShell />;
}
