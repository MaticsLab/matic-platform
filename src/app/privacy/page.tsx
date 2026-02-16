import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | MaticsApp',
  description: 'Privacy Policy for MaticsApp by Matics Lab INC',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-blue-600 hover:underline text-sm mb-6 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Effective Date: February 16, 2026 &middot; Last Updated: February 16, 2026</p>

        <div className="bg-white rounded-lg shadow p-8 space-y-8 text-gray-700 leading-relaxed">

          {/* 1. Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Introduction</h2>
            <p>
              Matics Lab INC (&ldquo;Matics Lab,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the MaticsApp platform (the &ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you access or use our Service, including any associated websites, applications, and services.
            </p>
            <p className="mt-2">
              By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree, please discontinue use of the Service immediately.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.1 Information You Provide Directly</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Account Information:</strong> Name, email address, password, and organization details when you register for an account.</li>
              <li><strong>Profile Information:</strong> Job title, profile photo, and other optional details you provide.</li>
              <li><strong>Content and Submissions:</strong> Data, forms, files, documents, and other content you create, upload, or submit through the Service.</li>
              <li><strong>Communications:</strong> Information you provide when you contact us for support, provide feedback, or otherwise communicate with us.</li>
              <li><strong>Payment Information:</strong> Billing address and payment card details (processed securely through our third-party payment processor; we do not store complete payment card numbers).</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Device and Usage Data:</strong> IP address, browser type and version, operating system, device identifiers, referring URLs, pages viewed, features used, clickstream data, and timestamps.</li>
              <li><strong>Cookies and Similar Technologies:</strong> We use cookies, web beacons, pixels, and similar tracking technologies to collect information about your interactions with the Service. You can manage cookie preferences through your browser settings.</li>
              <li><strong>Log Data:</strong> Server logs that automatically record information such as your IP address, access times, and the pages you visit.</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.3 Information from Third Parties</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Single Sign-On Providers:</strong> If you authenticate using a third-party identity provider (e.g., Google, GitHub), we may receive your name, email address, and profile information as authorized by you.</li>
              <li><strong>Integration Partners:</strong> If you connect third-party services to the Service, we may receive data from those integrations as necessary to provide the Service.</li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong>Provide and Maintain the Service:</strong> To operate, deliver, and improve the features and functionality of the Service.</li>
              <li><strong>Account Administration:</strong> To create and manage your account, authenticate your identity, and provide customer support.</li>
              <li><strong>Communications:</strong> To send transactional emails, service announcements, security alerts, and, where permitted, marketing communications.</li>
              <li><strong>Analytics and Improvement:</strong> To understand usage trends, diagnose technical issues, and improve the Service.</li>
              <li><strong>Security and Fraud Prevention:</strong> To detect, investigate, and prevent fraudulent, unauthorized, or illegal activity, and to protect the rights and safety of Matics Lab, our users, and others.</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, legal processes, or enforceable governmental requests.</li>
              <li><strong>Personalization:</strong> To tailor your experience and provide content and features relevant to you.</li>
            </ul>
          </section>

          {/* 4. How We Share Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong>Service Providers:</strong> With trusted third-party vendors who perform services on our behalf (e.g., hosting, analytics, payment processing, email delivery), subject to confidentiality obligations.</li>
              <li><strong>Within Your Organization:</strong> With other members of your workspace or organization as necessary for the collaborative features of the Service.</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, legal process, or governmental request, or when we believe disclosure is necessary to protect the rights, property, or safety of Matics Lab, our users, or the public.</li>
              <li><strong>Business Transfers:</strong> In connection with any merger, acquisition, reorganization, sale of assets, or bankruptcy, in which case your information may be transferred to the successor entity.</li>
              <li><strong>With Your Consent:</strong> In any other circumstances where you have provided explicit consent for us to share your information.</li>
            </ul>
          </section>

          {/* 5. Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide you with the Service. We may also retain and use your information as necessary to comply with our legal obligations, resolve disputes, enforce our agreements, and for legitimate business purposes. When personal information is no longer required, we will securely delete or anonymize it.
            </p>
          </section>

          {/* 6. Data Security */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard administrative, technical, and physical safeguards designed to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include encryption of data in transit (TLS/SSL) and at rest, access controls, regular security assessments, and secure hosting infrastructure.
            </p>
            <p className="mt-2">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially reasonable means to protect your personal information, we cannot guarantee its absolute security.
            </p>
          </section>

          {/* 7. Your Rights and Choices */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Your Rights and Choices</h2>
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> Request that we correct inaccurate or incomplete personal information.</li>
              <li><strong>Deletion:</strong> Request that we delete your personal information, subject to certain legal exceptions.</li>
              <li><strong>Portability:</strong> Request a copy of your data in a structured, commonly used, machine-readable format.</li>
              <li><strong>Restriction:</strong> Request that we restrict the processing of your personal information.</li>
              <li><strong>Objection:</strong> Object to the processing of your personal information for certain purposes.</li>
              <li><strong>Withdraw Consent:</strong> Where processing is based on consent, withdraw your consent at any time without affecting the lawfulness of prior processing.</li>
              <li><strong>Opt-Out of Marketing:</strong> Unsubscribe from marketing emails by clicking the &ldquo;unsubscribe&rdquo; link in any marketing email or by contacting us directly.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us at <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>. We will respond to your request within the timeframe required by applicable law.
            </p>
          </section>

          {/* 8. California Privacy Rights (CCPA/CPRA) */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. California Privacy Rights (CCPA/CPRA)</h2>
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA), including the right to know what personal information we collect, the right to delete your personal information, the right to opt out of the sale or sharing of your personal information, and the right to non-discrimination for exercising your privacy rights.
            </p>
            <p className="mt-2">
              <strong>We do not sell or share your personal information</strong> as those terms are defined under the CCPA/CPRA. To submit a verifiable consumer request, please contact us at <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>.
            </p>
          </section>

          {/* 9. International Data Transfers */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to, stored, and processed in the United States or other countries where our service providers operate. These countries may have data protection laws that differ from those in your jurisdiction. By using the Service, you consent to such transfers. We take appropriate safeguards to ensure your personal information remains protected in accordance with this Privacy Policy, including the use of Standard Contractual Clauses or other lawful transfer mechanisms where required.
            </p>
          </section>

          {/* 10. European Users (GDPR) */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. European Users (GDPR)</h2>
            <p>
              If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, we process your personal data under the following legal bases:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong>Performance of a Contract:</strong> To provide the Service you have requested.</li>
              <li><strong>Legitimate Interests:</strong> For our legitimate business interests, such as fraud prevention, security, and service improvement, where those interests are not overridden by your data protection rights.</li>
              <li><strong>Consent:</strong> Where you have given consent for specific processing activities, such as marketing communications.</li>
              <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulations.</li>
            </ul>
            <p className="mt-2">
              You may lodge a complaint with your local data protection authority if you believe we have not complied with applicable data protection laws.
            </p>
          </section>

          {/* 11. Children's Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected personal information from a child under 16, we will take steps to delete such information promptly. If you believe a child has provided us with personal information, please contact us at <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>.
            </p>
          </section>

          {/* 12. Third-Party Links and Services */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">12. Third-Party Links and Services</h2>
            <p>
              The Service may contain links to third-party websites, services, or applications that are not operated by us. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party services you access.
            </p>
          </section>

          {/* 13. Changes to This Privacy Policy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">13. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, legal requirements, or other factors. We will notify you of any material changes by posting the revised Privacy Policy on this page and updating the &ldquo;Last Updated&rdquo; date. Your continued use of the Service after any changes constitutes your acceptance of the updated Privacy Policy. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          {/* 14. Contact Us */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">14. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-3 bg-gray-50 rounded-md p-4 text-sm">
              <p className="font-semibold">Matics Lab INC</p>
              <p>Email: <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a></p>
              <p>Website: <a href="https://maticsapp.com" className="text-blue-600 hover:underline">https://maticsapp.com</a></p>
            </div>
          </section>

        </div>

        <div className="text-center mt-8 space-y-2">
          <p className="text-gray-500 text-sm">
            Last updated: February 16, 2026
          </p>
          <p className="text-sm">
            <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
