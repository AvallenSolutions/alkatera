'use client';

import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { useState } from 'react';
import { ContactModal } from '@/marketing/components/ContactModal';

export default function PrivacyPolicyPage() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="bg-[#050505] min-h-screen w-full text-white selection:bg-[#ccff00] selection:text-black overflow-x-hidden">
      <Navigation onOpenContact={() => setIsContactOpen(true)} />

      <main className="max-w-3xl mx-auto px-6 pt-40 pb-24">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-gray-500 font-mono text-sm mb-12">Last Updated: 17 January 2026</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8 text-gray-300 leading-relaxed">
          <p>
            Avallen Solutions Ltd trading as Alkatera (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the Alkatera platform (https://alkatera.com), a sustainability management system for the drinks industry. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">1. Information We Collect</h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">1.1 Personal Information</h3>
            <p>We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account information: name, email address, phone number, job title</li>
              <li>Organisation details: company name, business address, company registration number</li>
              <li>Payment information: billing address, payment card details (processed by our payment provider)</li>
              <li>Communications: correspondence with our support team</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">1.2 Business and Environmental Data</h3>
            <p>To provide our sustainability analytics services, we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Facility information: locations, energy consumption, operational data</li>
              <li>Production data: raw ingredients, fermentation data, packaging specifications</li>
              <li>Supply chain information: supplier details, transportation data, sourcing origins</li>
              <li>Environmental metrics: carbon emissions, water usage, waste diversion rates</li>
              <li>Product information: SKU details, lifecycle assessment data</li>
              <li>Certification and compliance data: B Corp assessments, sustainability certifications</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">1.3 Automatically Collected Information</h3>
            <p>When you access our platform, we automatically collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Device information: IP address, browser type, operating system</li>
              <li>Usage data: pages visited, features used, time spent on platform</li>
              <li>Cookies and similar technologies: see our <a href="/cookies" className="text-[#ccff00] hover:underline">Cookie Policy</a> for details</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve our sustainability platform</li>
              <li>Calculate and track environmental impact metrics (carbon footprint, water footprint, circularity scores)</li>
              <li>Generate sustainability reports and analytics</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service-related communications and updates</li>
              <li>Respond to your enquiries and provide customer support</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations and regulatory requirements</li>
              <li>Develop new features and services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">3. Legal Basis for Processing (GDPR)</h2>
            <p>Under the UK and EU General Data Protection Regulation, we process your data based on:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-white">Contract Performance:</strong> Processing necessary to provide our services to you</li>
              <li><strong className="text-white">Legitimate Interests:</strong> Improving our services, fraud prevention, security</li>
              <li><strong className="text-white">Legal Obligation:</strong> Compliance with applicable laws and regulations</li>
              <li><strong className="text-white">Consent:</strong> Where you have given explicit consent for specific processing activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">4. Data Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-white">Service Providers:</strong> Third parties who assist us in operating our platform (hosting, payment processing, analytics)</li>
              <li><strong className="text-white">Business Partners:</strong> With your consent, partners who provide complementary sustainability services</li>
              <li><strong className="text-white">Legal Requirements:</strong> When required by law, court order, or governmental authority</li>
              <li><strong className="text-white">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">5. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries outside the UK and European Economic Area. When we transfer data internationally, we ensure appropriate safeguards are in place, including Standard Contractual Clauses approved by the European Commission or adequacy decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide services. We retain certain information as necessary to comply with legal obligations, resolve disputes, and enforce agreements. Environmental and sustainability data may be retained longer for historical analysis and reporting purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">7. Your Rights</h2>
            <p>Under applicable data protection laws, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-white">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-white">Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong className="text-white">Erasure:</strong> Request deletion of your data (subject to legal retention requirements)</li>
              <li><strong className="text-white">Restriction:</strong> Request limitation of processing</li>
              <li><strong className="text-white">Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong className="text-white">Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong className="text-white">Withdraw Consent:</strong> Where processing is based on consent</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:support@alkatera.com" className="text-[#ccff00] hover:underline">support@alkatera.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">8. Data Security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your information, including encryption, access controls, secure hosting infrastructure, and regular security assessments. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">9. Children&apos;s Privacy</h2>
            <p>
              Our platform is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on our platform and updating the &lsquo;Last Updated&rsquo; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
            <p className="mt-2">
              Avallen Solutions Ltd trading as Alkatera<br />
              Email: <a href="mailto:support@alkatera.com" className="text-[#ccff00] hover:underline">support@alkatera.com</a><br />
              Website: <a href="https://alkatera.com" className="text-[#ccff00] hover:underline">https://alkatera.com</a>
            </p>
            <p className="mt-4 text-sm text-gray-500">
              You also have the right to lodge a complaint with the Information Commissioner&apos;s Office (ICO) if you are concerned about how we handle your data.
            </p>
          </section>
        </div>
      </main>

      <Footer />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
