'use client';

import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { useState } from 'react';
import { ContactModal } from '@/marketing/components/ContactModal';

export function CookiesPageClient() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className="bg-[#050505] min-h-screen w-full text-white selection:bg-[#ccff00] selection:text-black overflow-x-hidden">
      <Navigation onOpenContact={() => setIsContactOpen(true)} />

      <main className="max-w-3xl mx-auto px-6 pt-40 pb-24">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
        <p className="text-gray-500 font-mono text-sm mb-12">Last Updated: 17 January 2026</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8 text-gray-300 leading-relaxed">
          <p>
            This Cookie Policy explains how Avallen Solutions Ltd trading as Alkatera (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) uses cookies and similar technologies when you visit our website (https://alkatera.com) and use our platform.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work efficiently and provide information to website owners. Cookies can be &lsquo;session&rsquo; cookies (deleted when you close your browser) or &lsquo;persistent&rsquo; cookies (remain until they expire or you delete them).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">2. How We Use Cookies</h2>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">2.1 Strictly Necessary Cookies</h3>
            <p>These cookies are essential for the platform to function. They enable core features such as:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>User authentication and session management</li>
              <li>Security features and fraud prevention</li>
              <li>Load balancing and server optimisation</li>
            </ul>
            <p>You cannot opt out of these cookies as they are necessary for the platform to operate.</p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">2.2 Functional Cookies</h3>
            <p>These cookies enable enhanced functionality and personalisation:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Remembering your preferences and settings</li>
              <li>Remembering your language preferences</li>
              <li>Storing your dashboard customisations</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">2.3 Analytics Cookies</h3>
            <p>These cookies help us understand how visitors interact with our platform:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Tracking page views and navigation patterns</li>
              <li>Measuring platform performance</li>
              <li>Identifying popular features and areas for improvement</li>
            </ul>
            <p>We use analytics services that may set their own cookies.</p>

            <h3 className="text-lg font-medium text-white mt-6 mb-3">2.4 Marketing Cookies</h3>
            <p>With your consent, we may use cookies to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Deliver relevant advertisements</li>
              <li>Measure the effectiveness of advertising campaigns</li>
              <li>Limit how often you see an advertisement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">3. Cookies We Use</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-white/10 mt-4">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-3 text-white font-medium">Cookie</th>
                    <th className="p-3 text-white font-medium">Purpose</th>
                    <th className="p-3 text-white font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr><td className="p-3 font-mono text-xs">session_id</td><td className="p-3">Session management</td><td className="p-3">Session</td></tr>
                  <tr><td className="p-3 font-mono text-xs">csrf_token</td><td className="p-3">Security protection</td><td className="p-3">Session</td></tr>
                  <tr><td className="p-3 font-mono text-xs">auth_token</td><td className="p-3">Authentication</td><td className="p-3">7 days</td></tr>
                  <tr><td className="p-3 font-mono text-xs">user_preferences</td><td className="p-3">Stores user settings</td><td className="p-3">1 year</td></tr>
                  <tr><td className="p-3 font-mono text-xs">dashboard_layout</td><td className="p-3">Dashboard customisation</td><td className="p-3">1 year</td></tr>
                  <tr><td className="p-3 font-mono text-xs">_ga</td><td className="p-3">Google Analytics identifier</td><td className="p-3">2 years</td></tr>
                  <tr><td className="p-3 font-mono text-xs">_gid</td><td className="p-3">Google Analytics session</td><td className="p-3">24 hours</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">4. Third-Party Cookies</h2>
            <p>
              Some cookies are placed by third-party services that appear on our pages. We do not control these cookies. Third parties include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Google Analytics (analytics)</li>
              <li>Payment processors (essential for transactions)</li>
              <li>Customer support tools</li>
            </ul>
            <p>Please refer to these third parties&apos; privacy policies for more information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">5. Managing Cookies</h2>
            <p>You can control cookies through:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-white">Cookie Consent Banner:</strong> When you first visit our site, you can choose which optional cookies to accept</li>
              <li><strong className="text-white">Browser Settings:</strong> Most browsers allow you to refuse or delete cookies through settings</li>
              <li><strong className="text-white">Platform Settings:</strong> Logged-in users can manage preferences in account settings</li>
            </ul>
            <p>Note that blocking some cookies may impact your experience and the functionality available to you.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">6. Browser-Specific Instructions</h2>
            <p>To manage cookies in your browser:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-white">Chrome:</strong> Settings &gt; Privacy and Security &gt; Cookies</li>
              <li><strong className="text-white">Firefox:</strong> Options &gt; Privacy &amp; Security &gt; Cookies</li>
              <li><strong className="text-white">Safari:</strong> Preferences &gt; Privacy &gt; Cookies</li>
              <li><strong className="text-white">Edge:</strong> Settings &gt; Privacy &amp; Services &gt; Cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">7. Similar Technologies</h2>
            <p>We may also use similar technologies including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-white">Local Storage:</strong> For storing data locally in your browser</li>
              <li><strong className="text-white">Session Storage:</strong> For temporary storage during a session</li>
              <li><strong className="text-white">Pixel Tags:</strong> Small graphics to track user behaviour</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">8. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy to reflect changes in our practices or legal requirements. The &lsquo;Last Updated&rsquo; date indicates when changes were made.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-10 mb-4">9. Contact Us</h2>
            <p>If you have questions about our use of cookies:</p>
            <p className="mt-2">
              Avallen Solutions Ltd trading as Alkatera<br />
              Email: <a href="mailto:hello@alkatera.com" className="text-[#ccff00] hover:underline">hello@alkatera.com</a><br />
              Website: <a href="https://alkatera.com" className="text-[#ccff00] hover:underline">https://alkatera.com</a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
