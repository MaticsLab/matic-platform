import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | MaticsApp',
  description: 'Privacy Policy for MaticsApp by Matics Lab INC',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-gray-900 tracking-tight">MaticsApp</Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">Terms</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/auth" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">MaticsApp&trade; Privacy Policy</h1>
        <p className="text-gray-500 mb-12">Last modified: February 16, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed text-[15px]">

          <p>
            Matics Lab INC, together with its representatives, consultants, employees, officers, and directors (collectively &ldquo;MaticsApp,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the website located at www.maticsapp.com (the &ldquo;Site&rdquo;) and the services for building dynamic forms (&ldquo;Forms&rdquo;), data tables, review workflows, and related features, content, applications, or products offered by MaticsApp (together with the Site, the &ldquo;Services&rdquo;).
          </p>
          <p>
            MaticsApp respects and protects the privacy of the users that use our Services. We maintain strict policies to ensure the privacy of those who use our Services (&ldquo;End Users,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) or those who may just access our Site without otherwise using our Services (&ldquo;Visitors&rdquo;). This policy (&ldquo;Privacy Policy&rdquo;) describes the types of information we may collect from you and our practices for collecting, using, maintaining, protecting, and disclosing such information. This Privacy Policy also includes a description of certain rights that you may have over information that we may collect from you.
          </p>
          <p>
            By using the Services, you agree to this Privacy Policy. If you do not agree with our policies and practices, your choice is to not use our Services.
          </p>

          {/* Summary Table */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">Summary of Data Collection, Disclosure and Sale</h2>
          <p>
            Here is a short summary of data, the categories of data we have collected, disclosed, and/or sold over the last twelve months. We do not sell data, however, and the rest of this Privacy Policy provides more in-depth information on our privacy practices.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 border-b">Category</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-900 border-b">Collect?</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-900 border-b">Disclose?</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-900 border-b">Sell?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="px-4 py-3">Identifiers (name, email, IP address, account name)</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Categories of PI described in the CCPA (name, email, phone, address)</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Commercial information (transaction info, payment details)</td><td className="text-center px-4 py-3">Yes (via third-party processors)</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Geolocation data (device location)</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Internet or electronic network activity (browsing, interactions)</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Inferences drawn from other PI (preferences, characteristics)</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Biometric information</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Protected classifications under California or federal law</td><td className="text-center px-4 py-3">Yes (only if End Users request via Forms)</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Audio, visual or similar information</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Professional or employment-related information</td><td className="text-center px-4 py-3">Yes (work email address)</td><td className="text-center px-4 py-3">Yes</td><td className="text-center px-4 py-3">No</td></tr>
                <tr><td className="px-4 py-3">Non-public education information (FERPA)</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td><td className="text-center px-4 py-3">No</td></tr>
              </tbody>
            </table>
          </div>

          {/* Information We Collect */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">INFORMATION THAT MATICSAPP COLLECTS</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Types of Information Collected</h3>

          <h4 className="text-lg font-semibold text-gray-900 mt-6">Personal Data</h4>
          <p>
            &ldquo;Personal Data&rdquo; is information by which you may be personally identified. MaticsApp may collect the following Personal Data from you:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Name;</li>
            <li>Email;</li>
            <li>Financial information for payment processing; and</li>
            <li>Username and/or Password (Optional to log in to the Services).</li>
          </ul>
          <p>
            Your payment information may be collected by third-party vendors, including our payment processor, Stripe. Such identifying information is not collected or stored by MaticsApp.
          </p>
          <p>
            In addition to the Services storing the data that is submitted by third parties through the Forms, you may choose to store such data externally from the Services. With respect to the data that you or your designated data storage provider stores, you shall be solely responsible for your own data storage practices of any such data that you collect from third parties through the Forms.
          </p>
          <p>
            Additionally, an End User may request certain information from you, including personal information, through a Form created through the Services. If you have any questions about the content of any Form, please contact the person or entity that created the Form as they may have their own privacy policies. MaticsApp is not responsible for the content of any Form, or for the content of any responses submitted to any Form.
          </p>

          <h4 className="text-lg font-semibold text-gray-900 mt-6">Non-Personal Data</h4>
          <p>
            Non-personal data includes any data that cannot be used on its own to identify, trace, or identify a person. We may collect feedback and your device information, including IP address, browser type, domain names, and access times.
          </p>
          <p>
            When non-Personal Data you give to us is combined with Personal Data we collect about you, it will be treated as Personal Data and we will only use it in accordance with this Privacy Policy.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">How We Collect Information</h3>
          <p>We collect information about you in a couple of ways:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>When you provide it to us directly through an interaction with us; for example:
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                <li>When you register for the Services;</li>
                <li>When you fill out feedback forms and surveys;</li>
                <li>When you pay for Services;</li>
                <li>When you contact us for service requests via email or live chat.</li>
              </ul>
            </li>
            <li>Through automated collection methods like cookies or log files;</li>
            <li>When we obtain the information through a third party, including third-party data verification entities, payment processors, or when you choose to login via a connected email address.</li>
          </ol>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Why We Collect and How We Use Your Information (Legal Basis)</h3>
          <p>We collect and use your Personal Data when we have a legitimate purpose to do so, including the following reasons:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>To verify your eligibility to use the Services;</li>
            <li>When it is necessary for the general functioning of the Services, including to facilitate payment or to contact you;</li>
            <li>When it is necessary in connection with any contract you have entered into with us (including our Terms of Service) or to take steps prior to entering into a contract with us;</li>
            <li>When we have obtained your or a third party&apos;s prior consent;</li>
            <li>When we have a legitimate interest in processing your information for the purpose of providing or improving our Services;</li>
            <li>When we have a legitimate interest in using the information for the purpose of contacting you, subject to compliance with applicable law; or</li>
            <li>When we have a legitimate interest in using the information for the purpose of detecting, and protecting against, breaches of our policies and applicable laws.</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Legal Bases for Processing European Information</h3>
          <p>
            If you are located in the European Economic Area or the United Kingdom (collectively, &ldquo;Europe&rdquo;), we only process your Personal Data when we have a valid legal basis to do so, including the following reasons:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Consent.</strong> We may process your Personal Data where you have consented to certain processing of your Personal Data. For example, we may process your Personal Data to send you marketing communications or to use Cookies where you have consented to such use.</li>
            <li><strong>Contractual Necessity.</strong> We may process your Personal Data where required to provide you with our Services. For example, we may need to process your Personal Data to respond to your inquiries or requests.</li>
            <li><strong>Legal Obligation.</strong> We may process your Personal Data where we have a legal obligation to do so. For example, we may process your Personal Data to comply with tax, labor and accounting obligations.</li>
            <li><strong>Legitimate Interests.</strong> We may process your Personal Data where we or a third party have a legitimate interest in processing your Personal Data. Specifically, we have a legitimate interest in using your Personal Data for product development and internal analytics purposes, and otherwise to improve the safety, security, and performance of our Services. We only rely on our or a third party&apos;s legitimate interests to process your Personal Data when these interests are not overridden by your rights and interests.</li>
          </ul>
          <p>We may use aggregated (anonymized) information about our End Users, and information that does not identify any individual, without restriction.</p>

          {/* Accessing and Controlling */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">Accessing and Controlling Your Information</h2>
          <p>
            If you would like to prevent us from collecting your information completely, you should cease use of our Services. You can also control certain data via these other methods:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Correction capabilities:</strong> You have the ability to access and correct any inaccuracies in your personally identifiable information by emailing us at <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>. We may require you to provide reasonable information to verify your identity before we respond to any of your requests.</li>
            <li><strong>Opt-out of non-essential electronic communications:</strong> You may opt out of receiving newsletters and other non-essential messages by using the &lsquo;unsubscribe&rsquo; function included in all such messages. However, you will continue to receive notices and essential transactional emails.</li>
            <li><strong>Optional information:</strong> You can always choose not to fill in non-mandatory fields when you submit any form linked to our services.</li>
          </ul>

          <p className="mt-4">Residents of certain states in the United States have statutory data rights. We attempt to provide the same control and rights over your data no matter where you choose to live in the United States. As an End User of the Services, you have the following control over your data:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Right to access:</strong> You have the right to access (and obtain a copy of, if required) the categories of personal information that we hold about you, including the information&apos;s source, purpose and period of processing, and the persons to whom the information is shared.</li>
            <li><strong>Right to rectification:</strong> You have the right to update the information we hold about you or to rectify any inaccuracies. Based on the purpose for which we use your information, you can instruct us to add supplemental information about you in our database.</li>
            <li><strong>Right to erasure:</strong> You have the right to request that we delete your personal information in certain circumstances, such as when it is no longer necessary for the purpose for which it was originally collected.</li>
            <li><strong>Right to restriction of processing:</strong> You may also have the right to request to restrict the use of your information in certain circumstances, such as when you have objected to our use of your data but we need to verify whether we have overriding legitimate grounds to use it.</li>
            <li><strong>Right to data portability:</strong> You have the right to transfer your information to a third party in a structured, commonly used and machine-readable format, in circumstances where the information is processed with your consent or by automated means.</li>
            <li><strong>Right to object:</strong> You have the right to object to the use of your information in certain circumstances, such as the use of your personal information for direct marketing.</li>
          </ul>

          <p className="mt-4">Residents of Europe have the following additional rights:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>You have the right to lodge a complaint with a supervisory authority, including in your country of residence, place of work or where an incident took place.</li>
            <li>You may withdraw any consent you previously provided to us regarding the processing of your Personal Data at any time and free of charge. We will apply your preferences going forward and this will not affect the lawfulness of the processing before you withdrew your consent.</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Exercise Your Data Rights</h3>
          <p>
            We acknowledge your right to request access, amendment, or deletion of your data. We also recognize that you have the right to prohibit sale of your data, but we do not sell data.
          </p>
          <p>
            You can exercise the rights described above by sending an email to <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>. Only you, or an agent authorized to make a request on your behalf, may make a request related to your personal information.
          </p>
          <p>
            We cannot respond to your request if (i) we cannot verify your identity; or (ii) your request lacks sufficient details to help us handle the request. We will make best efforts to respond to your request within forty-five (45) days of its receipt. If we cannot respond in forty-five (45) days, we will inform you, in writing, the reason for the delay and will respond to your request within ninety (90) days. Any information we provide will only cover the twelve (12) month period preceding the request&apos;s receipt.
          </p>
          <p>
            We do not charge a fee to process or respond to your request unless it is excessive, repetitive, or manifestly unfounded. If we determine that the request warrants a fee, we will tell you why we made that decision and provide you with a cost estimate before completing your request. We are not obligated to provide responses to your data requests more than twice in a twelve (12)-month period.
          </p>

          {/* Automated Data Collection */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">Automated Data Collection Methods</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Cookies</h3>
          <p>
            A cookie is a small file placed on the hard drive of your computer. Cookies are used to help us manage and report on your interaction with the Site. Through cookies, we are able to collect information that we use to improve the Services, keep track of username/password, authenticate your login credentials and tailor your experience on the Services. If you turn off cookies, your experience on the Services will be significantly impaired or prevented.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Log Files</h3>
          <p>
            We use means through the Services to collect IP addresses, browser types, domain names, and access times. We use this information to optimize our platform, verify location, and maintain system security.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">How Long Do We Store Personal Data?</h3>
          <p>
            We will only retain your Personal Data for as long as is necessary to fulfill the purposes for which it is collected, or to comply with our legal obligations. This length of time may vary according to the nature of your relationship with us and mandatory retention periods provided by law.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Not Directed to Persons Under 18</h3>
          <p>
            Our Services are not intended for anyone under the age of 18, and we do not knowingly collect Personal Data from persons under 13. If we learn that we have collected or received Personal Data from a child under 13 without verification or parental consent, we will delete that information. If you believe we might have any information from or about a child under 13, please contact us at <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Do Not Track Settings</h3>
          <p>
            We do not track our Users over time and across third-party websites to provide targeted advertising and do not specifically respond to Do Not Track (&ldquo;DNT&rdquo;) signals.
          </p>

          {/* Who We Share Data With */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">WHO WE SHARE DATA WITH</h2>
          <p>
            We may use aggregated (anonymized) information about our End Users and Visitors, and information that does not identify any individual, without restriction.
          </p>
          <p>
            We do not sell or otherwise disclose Personal Data specific personal or transactional information to anyone except as described below.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Other Users</h3>
          <p>
            We may share your Personal Data collected through the Services with other End Users (such as other End Users within your organization) or their authorized agents when you authorize us to do so, or when you complete a Form requested by such End Users through our Services.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Affiliates and Subsidiaries</h3>
          <p>
            We may, for our legitimate interests, share your information with entities under common ownership or control with us who will process your information in a manner consistent with this Privacy Policy and subject to appropriate safeguards. Such parent companies, affiliates, or subsidiaries may be located in the United States.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Successors in Interest</h3>
          <p>
            We may, for our legitimate interests, share your information with a buyer or other successor in the event of a merger, divestiture, restructuring, reorganization, dissolution, or other sale or transfer of some or all of our assets, in which Personal Data about our End Users is among the assets transferred. You will be notified of any such change by a prominent notice displayed on our Services or by email. Any successor in interest to this Privacy Policy will be bound to the Privacy Policy at the time of transfer.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Law Enforcement and Other Governmental Agencies</h3>
          <p>
            We may share your information when we believe in good faith that such sharing is reasonably necessary to investigate, prevent, or take action regarding possible illegal activities or to comply with legal process. This may involve the sharing of your information with law enforcement, government agencies, courts, and other organizations.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Service Providers</h3>
          <p>
            We may, for our legitimate interests, share certain information with contractors, service providers, third-party authenticators, and other third parties we use to support our business and who are bound by contractual obligations to keep Personal Data confidential and use it only for the purposes for which we disclose it to them.
          </p>

          {/* Third-Party Services */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">THIRD-PARTY SERVICES AND WEBSITES</h2>
          <p>
            Our Services may contain links to, or you may optionally integrate or connect our Services with, other websites, products, or services that we do not own or operate (&ldquo;Third-Party Services&rdquo;).
          </p>
          <p>
            MaticsApp is not responsible for the privacy policies or other practices employed by these Third-Party Services linked to, or from, our Site nor the information or content contained therein, and we encourage you to read the privacy statements of any linked third party. If you have any questions about how these Third-Party Services use your personal information, you should contact them directly.
          </p>

          {/* Data Storage and Security */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">DATA STORAGE AND HOW MATICSAPP PROTECTS YOUR INFORMATION</h2>
          <p>
            MaticsApp stores basic End User data on our servers including name and email. Payments are not always required by End Users. If an End User makes a purchase and a payment is required, then payment information is processed and stored by our partners or service providers.
          </p>
          <p>
            Personal Data about End Users and Visitors is stored within the United States. The Services are only intended to be used inside the United States by residents of the United States who are 18 years of age or older. If you are using the Services from other regions with laws governing data collection and use, please note that you are agreeing to the transfer of your Personal Data to the United States in connection with storage and processing of data, fulfilling your requests, and use of our Services. By providing your Personal Data, you consent to such transfer, storage and processing in accordance with this Privacy Policy.
          </p>
          <p>
            MaticsApp employs physical, electronic, and managerial control procedures to safeguard and help prevent unauthorized access to your information. We choose these safeguards based on the sensitivity of the information that we collect, process and store and the current state of technology. Our outsourced service providers who support our operations are also vetted to ensure that they too have the appropriate organizational and technical measures in place to protect your information.
          </p>
          <p>
            Unfortunately, the transmission of information via the internet is not completely secure. Although we do our best to protect your Personal Data, we cannot guarantee the security of your information transmitted to the Services. Any transmission of information is at your own risk. We are not responsible for circumvention of any privacy settings or security measures contained on the Services. In the event that there is breach in the information that we hold, we shall notify of such breach via email or via notice on the Services.
          </p>

          {/* Changes */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">CHANGES TO THE PRIVACY POLICY</h2>
          <p>
            It is our policy to post any changes we make to our Privacy Policy on this page of the Site. If we make material changes to how we treat our End Users&apos; or Visitors&apos; Personal Data, we will notify you by email to the primary email address specified in your account or through a prominent notice on the Site. Such changes will be effective when posted. The date the Privacy Policy was last revised is identified at the top of the page. Your continued use of our Services following the posting of any modification to this Privacy Policy shall constitute your acceptance of the amendments to this Privacy Policy. You can choose to discontinue use of the Service if you do not accept any modified version of this Privacy Policy.
          </p>

          {/* Accessing & Deleting */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">Accessing and Deleting Your Data</h2>
          <p>
            If you would like to access a copy of your data, you may submit a request via email at <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>. We will provide you with the requested information within a reasonable time frame, in compliance with applicable laws.
          </p>
          <p>
            Should you wish to delete your account data, please send an email to <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a>.
          </p>

          {/* Google APIs Limited Use Disclosure */}
          <div className="border-t border-gray-200 pt-10 mt-12">
            <h2 className="text-2xl font-bold text-gray-900">MaticsApp&trade; Google APIs Limited Use Disclosure</h2>
            <p className="text-gray-500 text-sm mt-1">Effective Date: February 16, 2026</p>
            <p className="mt-4">
              MaticsApp&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>
          </div>

          {/* Questions and Comments */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">QUESTIONS AND COMMENTS</h2>
          <p>
            If you have any questions or comments about this Privacy Policy, or if you would like to file a request about the data we hold or file a deletion request, please contact our Privacy team by email at{' '}
            <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a> or by mail at:
          </p>
          <div className="mt-4 bg-gray-50 rounded-lg p-6 text-sm">
            <p className="font-semibold">Matics Lab INC</p>
            <p className="mt-1">Email: <a href="mailto:privacy@maticsapp.com" className="text-blue-600 hover:underline">privacy@maticsapp.com</a></p>
            <p>Website: <a href="https://maticsapp.com" className="text-blue-600 hover:underline">https://maticsapp.com</a></p>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Matics Lab INC. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-gray-900 transition-colors font-medium text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
