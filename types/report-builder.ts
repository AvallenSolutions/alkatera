export interface ReportConfig {
  reportName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  audience: 'investors' | 'regulators' | 'customers' | 'internal' | 'supply-chain' | 'technical';
  outputFormat: 'pptx';
  standards: string[];
  sections: string[];
  branding: {
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  isMultiYear?: boolean;
  reportYears?: number[];
}

export interface ReportDefaults {
  branding?: {
    logo?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
  };
  audience?: ReportConfig['audience'];
  standards?: string[];
}

export type WizardStep = 'configure' | 'content' | 'review';

export interface WizardStepInfo {
  id: WizardStep;
  label: string;
  description: string;
}

export const WIZARD_STEPS: WizardStepInfo[] = [
  {
    id: 'configure',
    label: 'Configure',
    description: 'Set up report basics',
  },
  {
    id: 'content',
    label: 'Select Content',
    description: 'Choose sections & data',
  },
  {
    id: 'review',
    label: 'Review & Generate',
    description: 'Preview and generate',
  },
];

export interface ReportProgressEvent {
  status: 'aggregating_data' | 'building_content' | 'generating_document' | 'completed' | 'failed';
  progress: number;
  message?: string;
  document_url?: string;
}
