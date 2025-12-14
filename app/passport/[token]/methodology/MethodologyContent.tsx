"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Database,
  FileCheck,
  Globe,
  Leaf,
  Scale,
  ShieldCheck,
  Workflow,
  ExternalLink,
  BookOpen,
  Layers,
  Target,
} from 'lucide-react';

interface MethodologyContentProps {
  productName: string;
  organizationName: string;
  functionalUnit: string;
  token: string;
}

const standards = [
  {
    name: 'ISO 14040:2006',
    fullName: 'Environmental Management - Life Cycle Assessment - Principles and Framework',
    description:
      'Establishes the general framework, principles, and requirements for conducting and reporting life cycle assessment studies. This standard provides the foundational methodology for our LCA approach.',
    url: 'https://www.iso.org/standard/37456.html',
  },
  {
    name: 'ISO 14044:2006',
    fullName: 'Environmental Management - Life Cycle Assessment - Requirements and Guidelines',
    description:
      'Specifies requirements and provides guidelines for life cycle assessment including goal and scope definition, inventory analysis, impact assessment, and interpretation phases.',
    url: 'https://www.iso.org/standard/38498.html',
  },
  {
    name: 'ISO 14067:2018',
    fullName: 'Greenhouse Gases - Carbon Footprint of Products - Requirements and Guidelines',
    description:
      'Specifies principles, requirements, and guidelines for the quantification and communication of the carbon footprint of products, based on ISO 14040 and ISO 14044.',
    url: 'https://www.iso.org/standard/71206.html',
  },
  {
    name: 'GHG Protocol Product Standard',
    fullName: 'Product Life Cycle Accounting and Reporting Standard',
    description:
      'The most widely used international accounting tool for understanding, quantifying, and managing greenhouse gas emissions from products across their lifecycle.',
    url: 'https://ghgprotocol.org/product-standard',
  },
];

const tools = [
  {
    name: 'openLCA',
    version: '2.0+',
    description:
      'Open-source life cycle assessment software used for modelling product systems and calculating environmental impacts. Provides transparent, reproducible calculations with full audit trails.',
    features: [
      'Process-based modelling',
      'Monte Carlo uncertainty analysis',
      'Contribution analysis',
      'Comparison of scenarios',
    ],
    url: 'https://www.openlca.org/',
    logo: '/images/openlca-logo.png',
  },
  {
    name: 'ecoinvent',
    version: '3.12',
    description:
      'The world\'s most comprehensive and reliable life cycle inventory database, providing consistent and transparent data for environmental impact assessment.',
    features: [
      '21,000+ datasets',
      'Geographically differentiated',
      'Multiple system models',
      'Regular updates',
    ],
    url: 'https://ecoinvent.org/',
    logo: '/images/ecoinvent-logo.png',
  },
];

const impactCategories = [
  {
    name: 'Climate Change (GWP100)',
    unit: 'kg CO2 eq.',
    method: 'IPCC 2021',
    description: 'Global warming potential over 100-year time horizon',
  },
  {
    name: 'Water Consumption',
    unit: 'L',
    method: 'AWARE',
    description: 'Freshwater consumption weighted by regional scarcity',
  },
  {
    name: 'Land Use',
    unit: 'm2a crop eq.',
    method: 'Soil Quality Index',
    description: 'Land occupation and transformation impacts',
  },
  {
    name: 'Resource Depletion',
    unit: 'kg Sb eq.',
    method: 'CML-IA',
    description: 'Depletion of abiotic resources (minerals and metals)',
  },
];

const systemBoundaryStages = [
  {
    stage: 'A1 - Raw Material Supply',
    included: true,
    description: 'Extraction and processing of raw materials, including agricultural production',
  },
  {
    stage: 'A2 - Transport to Manufacturing',
    included: true,
    description: 'Transportation of raw materials to production facilities',
  },
  {
    stage: 'A3 - Manufacturing',
    included: true,
    description: 'Production processes, energy consumption, and direct emissions',
  },
  {
    stage: 'A4 - Distribution',
    included: true,
    description: 'Transportation to distribution centres and retail',
  },
  {
    stage: 'A5 - Installation/Retail',
    included: false,
    description: 'Retail operations and shelf storage (excluded from scope)',
  },
  {
    stage: 'B1-B7 - Use Phase',
    included: false,
    description: 'Consumer use, maintenance, and repair (excluded from scope)',
  },
  {
    stage: 'C1-C4 - End of Life',
    included: false,
    description: 'Disposal, recycling, and waste treatment (excluded from scope)',
  },
];

export default function MethodologyContent({
  productName,
  organizationName,
  functionalUnit,
  token,
}: MethodologyContentProps) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-stone-900 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/passport/${token}`}
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-sm">Back to Passport</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block bg-brand-accent px-3 py-1 mb-4">
              <span className="font-mono text-xs font-bold text-black uppercase tracking-widest">
                Technical Documentation
              </span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl mb-4">
              LCA Methodology
            </h1>
            <p className="text-stone-400 max-w-2xl">
              Comprehensive documentation of the life cycle assessment methodology,
              data sources, and calculation standards used for {productName}.
            </p>
          </motion.div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-lime-100 rounded-lg">
              <Target className="w-5 h-5 text-lime-700" />
            </div>
            <h2 className="font-serif text-2xl text-stone-900">Goal and Scope</h2>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">
                  Functional Unit
                </h3>
                <p className="text-lg font-semibold text-stone-900 mb-2">
                  {functionalUnit}
                </p>
                <p className="text-sm text-stone-600">
                  All environmental impacts are expressed per functional unit,
                  enabling comparison with equivalent products.
                </p>
              </div>

              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">
                  System Boundary
                </h3>
                <p className="text-lg font-semibold text-stone-900 mb-2">
                  Cradle-to-Gate (A1-A4)
                </p>
                <p className="text-sm text-stone-600">
                  Assessment covers raw material extraction through to product
                  distribution, excluding use phase and end-of-life.
                </p>
              </div>

              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">
                  Reference Year
                </h3>
                <p className="text-lg font-semibold text-stone-900 mb-2">
                  2024
                </p>
                <p className="text-sm text-stone-600">
                  Primary data collected from operational year 2024,
                  with background data from ecoinvent v3.12.
                </p>
              </div>

              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">
                  Commissioning Organisation
                </h3>
                <p className="text-lg font-semibold text-stone-900 mb-2">
                  {organizationName}
                </p>
                <p className="text-sm text-stone-600">
                  LCA conducted using the Alkatera platform with
                  methodology oversight and quality assurance.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-lime-100 rounded-lg">
              <Layers className="w-5 h-5 text-lime-700" />
            </div>
            <h2 className="font-serif text-2xl text-stone-900">System Boundary</h2>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider text-stone-500">
                    Life Cycle Stage
                  </th>
                  <th className="px-6 py-4 text-center font-mono text-xs uppercase tracking-wider text-stone-500">
                    Included
                  </th>
                  <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider text-stone-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {systemBoundaryStages.map((item, i) => (
                  <tr key={i} className={item.included ? '' : 'bg-stone-50/50'}>
                    <td className="px-6 py-4 font-medium text-stone-900">
                      {item.stage}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.included ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {item.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-lime-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-lime-700" />
            </div>
            <h2 className="font-serif text-2xl text-stone-900">Standards Compliance</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {standards.map((standard, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl border border-stone-200 p-6 hover:border-lime-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-stone-900">{standard.name}</h3>
                  <a
                    href={standard.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lime-600 hover:text-lime-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-xs text-stone-500 mb-3">{standard.fullName}</p>
                <p className="text-sm text-stone-600">{standard.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-lime-100 rounded-lg">
              <Database className="w-5 h-5 text-lime-700" />
            </div>
            <h2 className="font-serif text-2xl text-stone-900">Tools and Databases</h2>
          </div>

          <div className="space-y-6">
            {tools.map((tool, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-white rounded-xl border border-stone-200 p-8"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-xl text-stone-900">
                        {tool.name}
                      </h3>
                      <span className="px-2 py-0.5 bg-stone-100 rounded text-xs font-mono text-stone-600">
                        v{tool.version}
                      </span>
                    </div>
                    <p className="text-stone-600 mb-4">{tool.description}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {tool.features.map((feature, j) => (
                        <span
                          key={j}
                          className="px-3 py-1 bg-lime-50 text-lime-700 rounded-full text-xs font-medium"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-lime-600 hover:text-lime-700 font-medium"
                    >
                      Learn more
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-lime-100 rounded-lg">
              <Scale className="w-5 h-5 text-lime-700" />
            </div>
            <h2 className="font-serif text-2xl text-stone-900">Impact Assessment Methods</h2>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider text-stone-500">
                    Impact Category
                  </th>
                  <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider text-stone-500">
                    Unit
                  </th>
                  <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider text-stone-500">
                    Method
                  </th>
                  <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider text-stone-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {impactCategories.map((category, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 font-medium text-stone-900">
                      {category.name}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-stone-600">
                      {category.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {category.method}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500">
                      {category.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-lime-100 rounded-lg">
              <Workflow className="w-5 h-5 text-lime-700" />
            </div>
            <h2 className="font-serif text-2xl text-stone-900">Data Quality</h2>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-3">
                  Primary Data
                </h3>
                <p className="text-sm text-stone-600 mb-4">
                  Primary data collected directly from {organizationName}&apos;s
                  operations, including:
                </p>
                <ul className="space-y-2 text-sm text-stone-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500 mt-1.5" />
                    Bill of materials quantities
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500 mt-1.5" />
                    Energy consumption records
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500 mt-1.5" />
                    Production volumes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500 mt-1.5" />
                    Transport distances
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-3">
                  Secondary Data
                </h3>
                <p className="text-sm text-stone-600 mb-4">
                  Background data sourced from ecoinvent v3.12, covering:
                </p>
                <ul className="space-y-2 text-sm text-stone-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                    Raw material production
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                    Energy grid mixes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                    Transport processes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                    Packaging materials
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-3">
                  Quality Indicators
                </h3>
                <p className="text-sm text-stone-600 mb-4">
                  Data quality assessed using pedigree matrix approach:
                </p>
                <ul className="space-y-2 text-sm text-stone-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                    Temporal representativeness
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                    Geographical representativeness
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                    Technological representativeness
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                    Completeness
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-lime-100 rounded-lg">
              <BookOpen className="w-5 h-5 text-lime-700" />
            </div>
            <h2 className="font-serif text-2xl text-stone-900">References</h2>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-8">
            <ul className="space-y-4 text-sm text-stone-600">
              <li>
                ISO 14040:2006 - Environmental management - Life cycle assessment - Principles and framework
              </li>
              <li>
                ISO 14044:2006 - Environmental management - Life cycle assessment - Requirements and guidelines
              </li>
              <li>
                ISO 14067:2018 - Greenhouse gases - Carbon footprint of products - Requirements and guidelines
              </li>
              <li>
                WRI/WBCSD (2011). Product Life Cycle Accounting and Reporting Standard. GHG Protocol.
              </li>
              <li>
                Wernet, G., et al. (2016). The ecoinvent database version 3. Int J Life Cycle Assess.
              </li>
              <li>
                IPCC (2021). Climate Change 2021: The Physical Science Basis. Sixth Assessment Report.
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="bg-stone-100 py-12 px-6 mt-16">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-lime-600" />
            <span className="font-semibold text-stone-700">Alkatera</span>
          </div>
          <p className="text-sm text-stone-500">
            Environmental data transparency through verified life cycle assessment
          </p>
        </div>
      </footer>
    </div>
  );
}
