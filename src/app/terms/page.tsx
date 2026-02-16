import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | MaticsApp',
  description: 'Terms of Service for MaticsApp by Matics Lab INC',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-blue-600 hover:underline text-sm mb-6 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Effective Date: February 16, 2026 &middot; Last Updated: February 16, 2026</p>

        <div className="bg-white rounded-lg shadow p-8 space-y-8 text-gray-700 leading-relaxed">

          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Acceptance of Terms</h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and Matics Lab INC (&ldquo;Matics Lab,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) governing your access to and use of the MaticsApp platform, including any associated websites, applications, APIs, and services (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p className="mt-2">
              By creating an account, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>, which is incorporated herein by reference. If you do not agree to these Terms, you must not access or use the Service.
            </p>
            <p className="mt-2">
              If you are accessing or using the Service on behalf of a company, organization, or other legal entity, you represent and warrant that you have the authority to bind such entity to these Terms, in which case &ldquo;you&rdquo; and &ldquo;your&rdquo; shall refer to such entity.
            </p>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 16 years of age to use the Service. By using the Service, you represent and warrant that you meet this age requirement and have the legal capacity to enter into these Terms. If you are under the age of majority in your jurisdiction, you must have the consent of a parent or legal guardian to use the Service.
            </p>
          </section>

          {/* 3. Account Registration and Security */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Account Registration and Security</h2>
            <p>
              To access certain features of the Service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain and promptly update your account information to keep it accurate and complete.</li>
              <li>Maintain the confidentiality of your account credentials and not share your login information with any third party.</li>
              <li>Accept responsibility for all activities that occur under your account.</li>
              <li>Notify us immediately at <a href="mailto:support@maticsapp.com" className="text-blue-600 hover:underline">support@maticsapp.com</a> if you suspect any unauthorized use of your account or any other security breach.</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate your account if any information provided is found to be inaccurate, false, or in violation of these Terms.
            </p>
          </section>

          {/* 4. Use of the Service */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Use of the Service</h2>
            <p>
              Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business or personal purposes.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">4.1 Acceptable Use</h3>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Use the Service for any unlawful purpose or in violation of any applicable local, state, national, or international law or regulation.</li>
              <li>Upload, transmit, or distribute any content that is infringing, defamatory, obscene, fraudulent, harmful, or otherwise objectionable.</li>
              <li>Attempt to gain unauthorized access to the Service, other user accounts, or any computer systems or networks connected to the Service.</li>
              <li>Interfere with or disrupt the integrity, performance, or availability of the Service or the data contained therein.</li>
              <li>Use automated means (bots, scrapers, crawlers) to access or collect data from the Service without our prior written consent.</li>
              <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service.</li>
              <li>Resell, sublicense, lease, or otherwise make the Service available to any third party without our prior written consent.</li>
              <li>Remove, alter, or obscure any proprietary notices, labels, or marks on the Service.</li>
              <li>Use the Service to send unsolicited communications (spam) or for phishing or social engineering.</li>
            </ul>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">4.2 Usage Limits</h3>
            <p>
              We may impose limits on your use of the Service, including storage, bandwidth, or the number of workspaces, forms, or submissions, depending on your subscription plan. We will endeavor to provide notice before enforcing or changing such limits.
            </p>
          </section>

          {/* 5. User Content */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. User Content</h2>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">5.1 Ownership</h3>
            <p>
              You retain all right, title, and interest in and to any data, content, materials, and information you submit, upload, or otherwise make available through the Service (&ldquo;User Content&rdquo;). These Terms do not grant us any ownership rights in your User Content.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">5.2 License Grant</h3>
            <p>
              By submitting User Content to the Service, you grant Matics Lab a worldwide, non-exclusive, royalty-free, sublicensable license to use, reproduce, modify, adapt, process, and display your User Content solely to the extent necessary to provide, maintain, and improve the Service. This license terminates when you delete your User Content or your account, except where your User Content has been shared with others who have not deleted it, or where retention is required by law.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">5.3 Responsibility for User Content</h3>
            <p>
              You are solely responsible for your User Content. You represent and warrant that you have all necessary rights to submit your User Content and that it does not violate the rights of any third party, including intellectual property rights, privacy rights, or contractual rights.
            </p>
          </section>

          {/* 6. Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Intellectual Property</h2>
            <p>
              The Service, including its original content, features, functionality, design, graphics, logos, trademarks, and underlying technology, is and shall remain the exclusive property of Matics Lab INC and its licensors. The Service is protected by copyright, trademark, patent, trade secret, and other intellectual property and proprietary rights laws of the United States and international jurisdictions.
            </p>
            <p className="mt-2">
              Nothing in these Terms grants you any right to use the Matics Lab or MaticsApp names, logos, domain names, trademarks, or other distinctive brand features without our prior written consent.
            </p>
          </section>

          {/* 7. Subscription Plans and Payment */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Subscription Plans and Payment</h2>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">7.1 Free and Paid Plans</h3>
            <p>
              The Service may be offered under free and paid subscription plans. Certain features and functionality may only be available under paid plans. Details regarding plan features and pricing are available on our website and may change from time to time.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">7.2 Billing and Renewal</h3>
            <p>
              If you subscribe to a paid plan, you agree to pay all applicable fees. Subscription fees are billed in advance on a recurring basis (monthly or annually, depending on the plan you select). Your subscription will automatically renew at the end of each billing cycle unless you cancel it before the renewal date.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">7.3 Refund Policy</h3>
            <p>
              Fees are generally non-refundable except where required by law. If you believe you are entitled to a refund, please contact us at <a href="mailto:support@maticsapp.com" className="text-blue-600 hover:underline">support@maticsapp.com</a>.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">7.4 Price Changes</h3>
            <p>
              We reserve the right to modify our pricing at any time. We will provide you with at least thirty (30) days&apos; prior written notice of any price increase. Continued use of the Service after a price change takes effect constitutes your agreement to the new pricing.
            </p>
          </section>

          {/* 8. Termination */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Termination</h2>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">8.1 Termination by You</h3>
            <p>
              You may terminate your account at any time by contacting us or using the account deletion functionality within the Service. Upon termination, your right to use the Service will immediately cease.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">8.2 Termination by Us</h3>
            <p>
              We may suspend or terminate your account and access to the Service at our sole discretion, without prior notice or liability, for any reason, including but not limited to a breach of these Terms. We may also terminate or suspend the Service (or any part thereof) at any time.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">8.3 Effect of Termination</h3>
            <p>
              Upon termination, your license to use the Service terminates. We may retain your data for a reasonable period as required by law or for legitimate business purposes. You may request export of your data prior to termination. Sections of these Terms that by their nature should survive termination shall survive, including Sections 5, 6, 9, 10, 11, 12, and 14.
            </p>
          </section>

          {/* 9. Disclaimers */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Disclaimers</h2>
            <p className="uppercase font-medium text-sm">
              THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, MATICS LAB INC DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p className="uppercase font-medium text-sm mt-2">
              MATICS LAB DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS, OR THAT ANY DEFECTS WILL BE CORRECTED. YOU ASSUME ALL RISK FOR YOUR USE OF THE SERVICE.
            </p>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Limitation of Liability</h2>
            <p className="uppercase font-medium text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL MATICS LAB INC, ITS DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, DATA, USE, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), STATUTE, OR ANY OTHER LEGAL THEORY, EVEN IF MATICS LAB HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="uppercase font-medium text-sm mt-2">
              IN NO EVENT SHALL MATICS LAB&apos;S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE EXCEED THE GREATER OF (A) THE AMOUNTS YOU HAVE PAID TO MATICS LAB IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100.00).
            </p>
            <p className="mt-2">
              Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities. In such jurisdictions, the limitations set forth above shall apply to the fullest extent permitted by applicable law.
            </p>
          </section>

          {/* 11. Indemnification */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Matics Lab INC and its officers, directors, employees, agents, affiliates, successors, and assigns from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related to: (a) your use of the Service; (b) your User Content; (c) your violation of these Terms; or (d) your violation of any rights of a third party.
            </p>
          </section>

          {/* 12. Dispute Resolution */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">12. Dispute Resolution</h2>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">12.1 Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of laws principles.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">12.2 Arbitration</h3>
            <p>
              Any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall be settled by binding arbitration administered by the American Arbitration Association (&ldquo;AAA&rdquo;) in accordance with its Commercial Arbitration Rules. The arbitration shall be conducted in the English language. The arbitrator&apos;s decision shall be final and binding. Judgment on the award may be entered in any court having jurisdiction.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">12.3 Class Action Waiver</h3>
            <p>
              YOU AND MATICS LAB AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. Unless both you and Matics Lab agree otherwise, the arbitrator may not consolidate or join more than one person&apos;s claims and may not preside over any form of a representative or class proceeding.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">12.4 Exceptions</h3>
            <p>
              Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of a party&apos;s copyrights, trademarks, trade secrets, patents, or other intellectual property rights.
            </p>
          </section>

          {/* 13. General Provisions */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">13. General Provisions</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy and any other policies or agreements referenced herein, constitute the entire agreement between you and Matics Lab regarding the Service and supersede all prior or contemporaneous agreements, understandings, or representations.</li>
              <li><strong>Severability:</strong> If any provision of these Terms is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect. The invalid or unenforceable provision shall be modified to the minimum extent necessary to make it valid and enforceable.</li>
              <li><strong>Waiver:</strong> The failure of Matics Lab to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.</li>
              <li><strong>Assignment:</strong> You may not assign or transfer these Terms or any rights or obligations hereunder without our prior written consent. We may assign these Terms without restriction.</li>
              <li><strong>Force Majeure:</strong> Matics Lab shall not be liable for any failure or delay in performance resulting from causes beyond our reasonable control, including but not limited to acts of God, natural disasters, pandemics, war, terrorism, labor disputes, government actions, power failures, or internet disturbances.</li>
              <li><strong>Notices:</strong> We may provide notices to you via email, posting within the Service, or other reasonable means. Notices to us should be sent to <a href="mailto:legal@maticsapp.com" className="text-blue-600 hover:underline">legal@maticsapp.com</a>.</li>
              <li><strong>Headings:</strong> The section headings in these Terms are for convenience only and shall not affect the interpretation of these Terms.</li>
            </ul>
          </section>

          {/* 14. Changes to These Terms */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">14. Changes to These Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by posting the revised Terms on this page and updating the &ldquo;Last Updated&rdquo; date. For material changes, we will make reasonable efforts to provide additional notice, such as via email or an in-app notification. Your continued use of the Service after the revised Terms take effect constitutes your acceptance of the updated Terms.
            </p>
          </section>

          {/* 15. Contact Us */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">15. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="mt-3 bg-gray-50 rounded-md p-4 text-sm">
              <p className="font-semibold">Matics Lab INC</p>
              <p>Email: <a href="mailto:legal@maticsapp.com" className="text-blue-600 hover:underline">legal@maticsapp.com</a></p>
              <p>General Support: <a href="mailto:support@maticsapp.com" className="text-blue-600 hover:underline">support@maticsapp.com</a></p>
              <p>Website: <a href="https://maticsapp.com" className="text-blue-600 hover:underline">https://maticsapp.com</a></p>
            </div>
          </section>

        </div>

        <div className="text-center mt-8 space-y-2">
          <p className="text-gray-500 text-sm">
            Last updated: February 16, 2026
          </p>
          <p className="text-sm">
            <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
