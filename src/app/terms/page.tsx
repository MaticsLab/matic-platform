import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | MaticsApp',
  description: 'Terms of Service for MaticsApp by Matics Lab INC',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-gray-900 tracking-tight">MaticsApp</Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/auth" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">MaticsApp&trade; Terms of Service</h1>
        <p className="text-gray-500 mb-4">Effective Date: February 16, 2026</p>
        <p className="text-gray-700 mb-12">
          MaticsApp is a platform provided and operated by Matics Lab INC, a Delaware corporation (&ldquo;MaticsApp,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; and/or &ldquo;our&rdquo;), located at{' '}
          <a href="https://www.maticsapp.com" className="text-blue-600 hover:underline">https://www.maticsapp.com/</a>{' '}
          (including all the areas available through such platform, the &ldquo;Site&rdquo;) and the Services (as defined below). Before using our Services, please carefully read these Terms of Service (&ldquo;Terms&rdquo; or &ldquo;Agreement&rdquo;). These Terms govern your use of the Services.
        </p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed text-[15px]">

          {/* 1. Acceptance of Terms */}
          <h2 className="text-2xl font-bold text-gray-900">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using the Services, you (&ldquo;User&rdquo; or &ldquo;you&rdquo;) acknowledge and agree to these legally binding Terms. You also agree to the MaticsApp{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> (&ldquo;Privacy Policy&rdquo;) and all other operational rules, policies, and procedures that may be published or otherwise made available on the Services, which are incorporated by reference.
          </p>
          <p>
            You agree to use the Services only for lawful purposes, and that you are responsible for all activity in connection with your use of the Services and in your communications with us, all of which must comply with these Terms. You hereby represent and warrant that you have the authority and are fully able and competent to enter into the terms, conditions, obligations, affirmations, representations and warranties set forth in this Agreement on behalf of yourself and/or an entity, and that you are able to abide by and comply with this Agreement.
          </p>

          {/* 2. MaticsApp Services */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">2. MaticsApp Platform Services</h2>
          <p>
            MaticsApp provides services for building dynamic forms (&ldquo;Forms&rdquo;), managing data tables, conducting review workflows, and related services, features, content, applications or products (together with the Site, the &ldquo;Services&rdquo;). Our Services may change from time to time and we reserve the right to modify, suspend, or discontinue the Services (including, but not limited to, the availability of any feature, integration, or Content), whether temporarily or permanently, at any time for any reason. You agree that MaticsApp shall not be liable to you or to any third party for any modification, suspension, or discontinuation of the Services. We may also impose limits on certain features and services or restrict your access to parts or all of the Services without notice or liability.
          </p>
          <p>
            We may make Forms, data tables, and certain software tools available to you in order to access and use the Services in accordance with these Terms. Depending on your subscription plan for the Services, you may choose to have us store the data, materials, or other input that you collect through use of the Forms (&ldquo;Form Input&rdquo;) or you may choose to store the Form Input on your own systems or with a cloud infrastructure provider of your choice.
          </p>

          {/* 3. Account Creation, Use, and Conduct */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">3. MaticsApp Account Creation, Use, and Conduct</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">MaticsApp Account Creation</h3>
          <p>
            In order to use certain aspects of the Services, Users are required to have a MaticsApp account (&ldquo;Account&rdquo;) and provide certain information about such Account holder as prompted by the account registration form. You must be at least eighteen (18) years of age, or the age of majority in your applicable state, to register an account.
          </p>
          <p>
            You represent and warrant that the information in your Account, and any other information you otherwise provide to us, is accurate, current, and complete information, and agree to update it and keep it accurate, current, and complete. We reserve the right to suspend or terminate your Account or your access to the Services if any information provided to us proves to be untrue, inaccurate, not current, or incomplete. You are solely responsible for maintaining the confidentiality of your Account and log-in credentials, and you agree to accept responsibility for all activities, charges, and damages that occur under your Account. EACH INDIVIDUAL USER MUST MAINTAIN AN INDIVIDUAL USER ACCOUNT WITH UNIQUE LOG-IN CREDENTIALS, INCLUDING USERNAME AND PASSWORD, IF APPLICABLE.
          </p>
          <p>
            It shall be a violation of these Terms to submit false information for registration or account maintenance, or to allow any other person to use your Account to participate in or otherwise use the Services. If you discover any unauthorized use of your Account, or other known Account-related security breach, you must report it to us immediately. You agree that you are responsible for anything that happens through your Account until you close your Account or prove that your Account security was compromised due to no fault of your own. We cannot and will not be liable for any loss or damage arising from your failure to comply with this section.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Use of the Account; Reservation of Rights</h3>
          <p>
            As a condition of use, you agree not to use the Services for any purpose that is prohibited by the Terms or law. We reserve the right to modify, suspend or discontinue all or any aspect of the Services with or without notice to you, including the suspension or takedown of any Form.
          </p>
          <p>You understand and agree that you will not use the Services to engage in the following prohibited conduct:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>You shall not use the Services for any illegal or fraudulent purpose, or in violation of any local, state, national, or international law, including, without limitation, laws governing intellectual property and other proprietary rights, data protection and privacy, and import or export control;</li>
            <li>You shall not use the Services for purposes of competitive analysis, the development of a competing product or service, or any other purpose that is to our commercial disadvantage;</li>
            <li>You shall not submit information or documentation to the Site that pertains or belongs to any other party without such party&apos;s prior written consent, nor knowingly submit any false or fraudulent information or documentation;</li>
            <li>You shall not use the Services to collect, use or disclose information that you do not have the consent to collect, use or disclose (including, but not limited to, the personally identifiable or confidential information of others, or information pertaining to minors under the age of 18 without parental consent);</li>
            <li>You shall not post, store, send, transmit, or disseminate any information or material which infringes any patents, trademarks, trade secrets, copyrights, or any other proprietary or intellectual property rights;</li>
            <li>You shall not attempt to use any method to gain unauthorized access to any features of the Services;</li>
            <li>You shall not directly or indirectly decipher, decompile, remove, disassemble, reverse engineer, or otherwise attempt to derive any source code or underlying ideas or algorithms of any part of the Services, except to the extent applicable laws specifically prohibit such restriction;</li>
            <li>You shall not directly or indirectly modify, translate, or otherwise create derivative works of any part of the Services;</li>
            <li>You shall not directly or indirectly license, copy, sell, rent, lease, distribute, or otherwise transfer any of the rights that you receive hereunder or commercially exploit the Services, in whole or in part;</li>
            <li>You shall not directly or indirectly take any action that constitutes unsolicited or unauthorized advertising or promotional material or any junk mail, spam, or chain letters;</li>
            <li>You shall not directly or indirectly suggest or otherwise create a false appearance of affiliation with MaticsApp or indicate that MaticsApp otherwise endorses, sponsors, or is affiliated with any products or services, nor impersonate any person or entity;</li>
            <li>You shall not directly or indirectly introduce into the Services any materials containing software viruses or any other computer codes, files, or programs that are designed or intended to disrupt, damage, limit, or interfere with the proper function of any software, hardware, or telecommunications equipment;</li>
            <li>You shall not directly or indirectly take any action that imposes or may impose an unreasonable or disproportionately large load on MaticsApp&apos;s or its third-party providers&apos; infrastructure; interfere or attempt to interfere with the proper working of the Service; run any form of auto-responder or &ldquo;spam&rdquo; on the Service; or use manual or automated software, devices, or other processes to &ldquo;crawl&rdquo; or &ldquo;spider&rdquo; any page of the Site;</li>
            <li>You shall not sell or otherwise transfer your Account; and</li>
            <li>You are prohibited from using the Services in a manner that: constitutes a direct or specific threat of violence to others; is in furtherance of illegal activities; is harassing, hateful, libelous, defamatory, abusive, vulgar, obscene, or constitutes spam; is pornographic, predatory, sexually graphic, racist, offensive, harmful to a minor, or would otherwise violate the rights of any third party or give rise to civil or criminal liability.</li>
          </ul>
          <p>
            If for any reason, we determine that you have failed to follow these rules, we reserve the right to prohibit any and all current or future use of the Services by you. If we have reason to suspect, or learn that anyone is violating these Terms, we may investigate and/or take legal action as necessary including bringing a lawsuit for damages caused by the violation. We reserve the right to investigate and take appropriate legal action, including without limitation, cooperating with and assisting law enforcement or government agencies in any resulting investigations of illegal conduct.
          </p>

          {/* 4. Forms and User Submissions */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">4. MaticsApp Forms and User Submissions</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Protection of Personally Identifiable Information (PII)</h3>
          <p>
            MaticsApp maintains administrative, physical, and technical safeguards for protection of the security, confidentiality and integrity of the personally identifiable information of an identified or identifiable natural person (&ldquo;PII&rdquo;). However, MaticsApp has no control over the nature, scope, or origin of, or the means by which a User acquires, any PII that such User may submit or upload to the Services or Form Input that User may collect through the Services. You are solely responsible for ensuring your compliance with any and all applicable laws, rules, or regulations applicable to the types of data, including PII, that you submit or make available to, or request or collect through, the Services. You represent and warrant to us that when you submit or make available any PII to, or request or collect through, the Services, you have obtained all necessary prior written consents, approvals, or authorizations from such natural persons to share such PII with MaticsApp (as applicable pursuant to your subscription plan for Services) and you agree to provide all copies of each such consent, approval, or authorization to MaticsApp upon reasonable request.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Acknowledgment of Platform</h3>
          <p>
            MaticsApp is not responsible for any loss or damage arising out of any decisions ultimately made or implemented based on your use of the Services. You understand and agree that any guidance MaticsApp provides as part of the Services is for informational purposes only. You understand and acknowledge that MaticsApp does not guarantee: the existence, quality, safety or legality of any content or information made available on or through the Services.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">User Interactions; Dispute Resolution</h3>
          <p>
            Subject to the terms of the MaticsApp Privacy Policy, your direct interactions (if any) with other Users of the Services or Forms, and any other terms, conditions, warranties, or representations associated with such dealings, are solely between you and that individual user. You further understand and agree that the Services merely enable the building and submission of Forms and management of data to be used by you, and that MaticsApp is not involved in any actual transactions enabled by your use of the Forms, and that it is not responsible for any loss or damage incurred as the result of any such dealings. IF THERE IS A DISPUTE BETWEEN YOU AND ANY THIRD PARTY (INCLUDING, WITHOUT LIMITATION, ANY USER OF THE SERVICE), MATICSAPP IS UNDER NO OBLIGATION TO BECOME INVOLVED, AND YOU HEREBY RELEASE MATICSAPP FROM ANY CLAIMS, DEMANDS, OR DAMAGES OF ANY KIND AND OF ANY NATURE ARISING OUT OF OR RELATING TO ANY SUCH DISPUTE.
          </p>

          {/* 5. Availability */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">5. Availability of the MaticsApp Services</h2>
          <p>
            While we use reasonable efforts to keep the Services accessible, the Services may be unavailable from time to time for any reason including, without limitation, system down time for routine maintenance. You further acknowledge that there may be interruptions in the Services or events on third-party sites that may affect your use of the Services that are beyond our control to prevent or correct. Accordingly, we cannot accept any responsibility for any connectivity issues that you may experience when using the Services or for any delays or loss of material, data, transactions or other information caused by system outages, whether planned or unplanned.
          </p>

          {/* 6. Access/License */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">6. Access/License for Use of the Services</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">MaticsApp License to Users</h3>
          <p>
            You have a limited, revocable, non-exclusive, non-transferable, non-sublicensable license to use the Services and our Content solely for legally permitted activities related to our Services as outlined in these Terms. You agree to respect all legal or proprietary notices, information, and restrictions contained in any content accessed through the Services.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">License to MaticsApp to User Content</h3>
          <p>
            In using the Services, you may be able to: (a) create Forms, (b) create and manage data tables, (c) post, upload, or otherwise make available certain information or documentation, or (d) request or collect Form Input, in each case through the Services, in order to use, or continue using, the Services (collectively, &ldquo;User Content&rdquo;). You understand and agree that you are responsible for whatever material you submit or collect through the Services and that you, not MaticsApp, have full responsibility for your User Content, including its legality, reliability, accuracy, appropriateness, originality, and copyright. By submitting User Content to the Services, you grant us and our service providers and business partners a nonexclusive, royalty-free, sub-licensable, and transferable (in whole or in part) worldwide license to use, modify, display, reproduce, and distribute such User Content on and through the Services in order to provide the Services.
          </p>

          {/* 7. Payments */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">7. Payments</h2>
          <p>
            In order to use certain features of the Services, you may be required to pay for the applicable subscription plan selected on the Site or via an order form for the Services (&ldquo;Fees&rdquo;). MaticsApp charges the Fees on a recurring basis at the selected time interval for your paid subscription plan (either monthly or annually in advance) to the payment method that you designate with MaticsApp. If your payment fails or if your payment information expires, you will be notified by MaticsApp and access to the Services will be suspended until payment is received. MaticsApp reserves the right to restrict access to your Account or terminate your Account for nonpayment if such nonpayment is not corrected within thirty (30) days. If you dispute any charges, you must inform us in writing within thirty (30) days of being billed by us. All payments are final and non-refundable.
          </p>

          {/* 8. Term and Termination */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">8. Term and Termination of Usage</h2>
          <p>
            Subject to this section, this Agreement shall remain in full force and effect while you use the Services. You may terminate your Account in accordance with your selected subscription plan through your account settings or by sending us an email at <a href="mailto:support@maticsapp.com" className="text-blue-600 hover:underline">support@maticsapp.com</a>.
          </p>
          <p>
            If you are a paid subscriber of the Services, your paid subscription will be automatically renewed and the payment method on file with your Account will be automatically charged to your designated payment method for each new subscription period in your subscription plan unless you notify us in writing of your intent to cancel your paid subscription at least 30 days prior to your next subscription billing period.
          </p>
          <p>
            We may suspend or cancel your Account without notice to you if you violate this Agreement, or for any reason at all. If your Account is cancelled, we reserve the right to remove your account information along with any account settings from our servers with NO liability or notice to you. Once your account information and account settings are removed, you will not be able to recover this data from your Account.
          </p>
          <p>
            Upon termination of your Account, your license to use our Services (including any Forms) terminates. All provisions of these Terms that by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, and limitations of liability. You acknowledge and understand that our rights regarding any content you submitted to the website before your Account was terminated shall survive termination. For the avoidance of doubt, we may retain certain User Content in our backups, archives and disaster recovery systems in order to comply with applicable legal requirements or until such User Content is deleted in the ordinary course of business. Termination will not limit any of MaticsApp&apos;s rights or remedies at law or equity.
          </p>

          {/* 9. Third-Party Sites */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">9. Advertisements and Third-Party Sites or Services</h2>
          <p>
            The Services may contain links to other websites or resources on the internet, or integrations with MaticsApp&apos;s third-party service providers, such as cloud infrastructure providers. Links on the Services to third-party websites, if any, are provided only as a convenience to you and such links are not under the control of MaticsApp. If you use these links, you will leave the Services. The inclusion or integration of third-party services or links in the Services does not imply control of, endorsement by, or affiliation with MaticsApp. Your dealings with third parties are solely between you and such third parties. You agree that we will not be responsible or liable for any content, goods or services provided on or through these outside websites or integrated services or for your use or inability to use such websites or services. You will use these links or integrated services at your own risk.
          </p>

          {/* 10. Intellectual Property */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">10. MaticsApp Intellectual Property and User Content</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Our Intellectual Property Rights and Content</h3>
          <p>
            We own all rights, title and interest, including any patents, inventions, copyrights, trademarks, domain names, trade secrets, know-how, and any other intellectual property or proprietary rights (collectively, &ldquo;Intellectual Property&rdquo;) in and to the Site and Services, or we are an authorized licensee for all Intellectual Property used for purposes of providing the Site and Services. All right, title, and interest in and to the Intellectual Property are and will remain with MaticsApp or its licensors. You will not use such Intellectual Property to develop competitive Services or sell, design, reverse engineer, decompile or disable any of the Services or software or change, translate, or otherwise create derivative works based off our Content. All other Content viewed through the Services is the property of its respective owner.
          </p>
          <p>
            We, including our affiliates, may ask you for your voluntary Feedback (as further defined below) on your experience with the Services. We shall become the owner of any User reviews, comments, suggestions or other feedback regarding the Services submitted through the Services or on MaticsApp&apos;s social media pages, if applicable (collectively, &ldquo;Feedback&rdquo;) and we may share with any of our affiliates. Without limitation, we will have exclusive ownership of all present and future existing rights to the Feedback of every kind and nature everywhere and will be entitled to use the Feedback for any commercial or other purpose whatsoever, including to advertise and promote MaticsApp, without compensation to you or any other person sending the Feedback. You specifically waive any &ldquo;moral rights&rdquo; in and to the Feedback. You agree that any Feedback you submit to MaticsApp will not contain any information or ideas that you consider to be confidential or proprietary. ALL RIGHTS NOT EXPRESSLY GRANTED HEREUNDER ARE RESERVED TO MATICSAPP.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">User Content</h3>
          <p>
            You acknowledge and agree that, except as otherwise expressly provided in these Terms or Privacy Policy, we are not responsible for any of your User Content, whether provided by you or others, or any information that you submit via the Services. You represent and warrant to us that (a) you own the User Content, or you otherwise have the legal right to use it, and you have received all necessary permissions, clearances from, or are authorized by, the owner of any part of the content to submit to the Services; (b) your User Content and Feedback will not contain third-party copyrighted material, or material that is subject to other third-party proprietary rights, unless you have permission from the rightful owner; (c) you have no agreement with or obligations to any third party with respect to the rights herein granted which conflict or interfere with any of the provisions of these Terms; and (d) you agree to abide by all applicable local, state, national, and foreign laws, treaties, and regulations in connection with your use of the Services.
          </p>
          <p>
            We may refuse to accept or transmit User Content. Additionally, we shall have the right to delete, edit, modify, reformat, excerpt, or translate any of your User Content solely for the purpose of providing the Services to you.
          </p>
          <p>
            Unless otherwise agreed with us as part of your subscription plan, you acknowledge and agree that we are not a data repository for any of your information or documentation, including but not limited to any Forms that you create or Form Input that you collect through use of the Services, and that you are solely responsible for backing up your User Content and/or keeping and maintaining such information or documentation in your personal records.
          </p>

          {/* 11. Copyright and Trademark */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">11. Copyright and Trademark Notices</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Copyright Policy</h3>
          <p>
            MaticsApp complies with the Digital Millennium Copyright Act (DMCA). We will remove infringing materials in accordance with the DMCA if properly notified that Content infringes copyright. If you believe that your work has been copied in a way that constitutes copyright infringement, please notify us by email at <a href="mailto:legal@maticsapp.com" className="text-blue-600 hover:underline">legal@maticsapp.com</a>. Your email must contain the following information:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>An electronic or physical signature of the person authorized to act on behalf of the owner of the copyright interest;</li>
            <li>Information reasonably sufficient to permit us to contact you, such as an address, telephone number, and, if available, an e-mail address;</li>
            <li>A description of the copyrighted work that you claim has been infringed;</li>
            <li>A description of where the material that you claim is infringing is located on the Services, sufficient for us to locate the material;</li>
            <li>A statement by you that you have a good faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law; and</li>
            <li>A statement by you that the information in your notice is accurate and, under penalty of perjury, that you are the copyright owner or authorized to act on the copyright owner&apos;s behalf.</li>
          </ul>
          <p>
            In accordance with the Digital Millennium Copyright Act, we have adopted a policy of, in appropriate circumstances, terminating User accounts that are repeat infringers of the intellectual property rights of others. We may also terminate User accounts even based on a single infringement.
          </p>

          {/* 12. Warranty and Disclaimer */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">12. Warranty and Disclaimer</h2>
          <p className="uppercase font-medium text-sm">
            THE SERVICES AND ALL INFORMATION CONTAINED HEREIN ARE PROVIDED ON AN &ldquo;AS IS&rdquo; BASIS WITHOUT ANY WARRANTIES OF ANY KIND.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Disclaimer of Actions of Other Users</h3>
          <p>
            MaticsApp does not endorse and is not responsible or liable for any products, services, information, or materials available or unavailable from, or through, any third parties or other Users of the Service. You agree that should you use or rely on such products, services, information, or materials, MaticsApp is not responsible or liable, indirectly or directly, for any damage or loss caused or alleged to be caused by or in connection with such use or reliance. YOU WAIVE THE RIGHT TO BRING OR ASSERT ANY CLAIM AGAINST MATICSAPP RELATING TO ANY INTERACTIONS OR DEALINGS WITH ANY USER OF THE SERVICE, AND RELEASE MATICSAPP FROM ANY AND ALL LIABILITY FOR OR RELATING TO ANY INTERACTIONS OR DEALINGS WITH THIRD PARTIES OR OTHER USERS OF THE SERVICES.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Disclaimer of Warranties</h3>
          <p className="uppercase font-medium text-sm">
            THE MATICSAPP SERVICES ARE PROVIDED TO USERS &ldquo;AS-IS&rdquo; AND WITH ALL FAULTS AND DEFECTS WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, MATICS LAB INC AND ITS PARENTS, SUBSIDIARIES AND AFFILIATES EXPRESSLY DISCLAIM ALL WARRANTIES OF ANY KIND PERTAINING TO THE SERVICES AND THE INFORMATION OR MATERIALS HEREIN, WHETHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, SATISFACTORY QUALITY, SECURITY, ACCURACY, AVAILABILITY, USE REASONABLE CARE AND SKILL, AND NON-INFRINGEMENT, AS WELL AS WARRANTIES ARISING BY USAGE OF TRADE, COURSE OF DEALING, AND COURSE OF PERFORMANCE. ALL INFORMATION PROVIDED ON OR THROUGH THE SERVICES IS SUBJECT TO CHANGE WITHOUT NOTICE. MATICSAPP MAKES NO WARRANTY THAT (I) THE SERVICES WILL MEET YOUR REQUIREMENTS OR THAT INFORMATION MADE AVAILABLE THROUGH THE SERVICES IS ACCURATE OR COMPLETE, (II) THE SERVICES WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE OR FREE OF VIRUSES OR BUGS, AND (III) ANY ERRORS IN OR ON THE SERVICES WILL BE CORRECTED. ANY MATERIAL, CONTENT, OR INFORMATION DOWNLOADED OR OTHERWISE OBTAINED AND/OR USED THROUGH THE SERVICES IS DONE AT YOUR OWN DISCRETION AND RISK AND YOU WILL BE SOLELY RESPONSIBLE FOR ANY DAMAGE TO YOUR COMPUTER SYSTEM OR LOSS OF DATA THAT RESULTS FROM THE DOWNLOAD OF ANY SUCH MATERIAL, CONTENT OR INFORMATION. FURTHER, MATICSAPP SHALL NOT BE LIABLE FOR ANY DECISION MADE OR IMPLEMENTED BASED ON USER&apos;S USE OF THE SERVICES. YOU AGREE THAT USE OF THE SERVICES IS AT YOUR OWN RISK, AND MATICSAPP ASSUMES NO RESPONSIBILITY OR LIABILITY FOR ANY INFORMATION COLLECTED BY YOUR USE OF THE FORMS, OR THE TRUTHFULNESS, ACCURACY, TIMELINESS, OR COMPLETENESS OF ANY CONTENT OR FAILURE BY THE SERVICES.
          </p>

          {/* 13. Limitation of Liability */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">13. Limitation of Liability</h2>
          <p className="uppercase font-medium text-sm">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, YOU HEREBY RELEASE MATICSAPP, TOGETHER WITH ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, PARTNERS, SUPPLIERS, CONTRACTORS, OR CONTENT PROVIDERS, FROM ALL LIABILITY ASSOCIATED WITH YOUR USE OF THE SERVICES. IF YOU ARE A CALIFORNIA RESIDENT, YOU HEREBY WAIVE CALIFORNIA CIVIL CODE SECTION 1542 IN CONNECTION WITH THE FOREGOING, WHICH STATES: &ldquo;A GENERAL RELEASE DOES NOT EXTEND TO CLAIMS THAT THE CREDITOR OR RELEASING PARTY DOES NOT KNOW OR SUSPECT TO EXIST IN HIS OR HER FAVOR AT THE TIME OF EXECUTING THE RELEASE AND THAT, IF KNOWN BY HIM OR HER, WOULD HAVE MATERIALLY AFFECTED HIS OR HER SETTLEMENT WITH THE DEBTOR OR RELEASED PARTY.&rdquo;
          </p>
          <p className="uppercase font-medium text-sm mt-4">
            EXCEPT AS OTHERWISE SPECIFICALLY PROVIDED, IN NO EVENT SHALL MATICSAPP, NOR ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, PARTNERS, SUPPLIERS, CONTRACTORS, OR CONTENT PROVIDERS, BE LIABLE UNDER CONTRACT, TORT, STRICT LIABILITY, NEGLIGENCE, OR ANY OTHER LEGAL OR EQUITABLE THEORY WITH RESPECT TO THE SERVICE (I) FOR ANY LOST PROFITS, DATA LOSS, COST OF PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES, OR SPECIAL, INDIRECT, INCIDENTAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES OF ANY KIND WHATSOEVER, SUBSTITUTE GOODS OR SERVICES (HOWEVER ARISING), (II) FOR ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE (REGARDLESS OF THE SOURCE OF ORIGINATION), OR (III) FOR ANY DIRECT DAMAGES IN EXCESS OF THE GREATER OF (IN THE AGGREGATE) ONE HUNDRED U.S. DOLLARS ($100.00) OR THE AMOUNT OF FEES PAID AND OWED BY YOU TO MATICSAPP UNDER THIS AGREEMENT DURING THE TWELVE (12) MONTH PERIOD PRIOR TO THE DATE THE CLAIM AROSE. SOME STATES OR COUNTRIES DO NOT ALLOW THE EXCLUSION OR LIMITATION OF INCIDENTAL OR CONSEQUENTIAL DAMAGES, SO THE ABOVE LIMITATIONS AND EXCLUSIONS MAY NOT APPLY TO YOU. IN THESE JURISDICTIONS, MATICSAPP&apos;S LIABILITY WILL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          </p>

          {/* 14. Indemnification */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">14. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless MaticsApp (including our affiliates and subsidiaries, as well as our and their respective officers, directors, employees, agents, partners, suppliers, contractors, content providers, successors, and assigns) from and against any and all losses, damages, liabilities, deficiencies, claims, actions, judgments, settlements, interest, awards, penalties, fines, costs, or expenses of whatever kind, including reasonable attorneys&apos; fees, arising from or relating to your use or misuse of the Services or your breach of this Agreement, including but not limited to your breach of any law or the rights of a third party.
          </p>

          {/* 15. Arbitration */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">15. Arbitration and Class Action Waiver</h2>
          <p className="font-semibold text-gray-900">PLEASE READ THIS SECTION CAREFULLY &ndash; IT MAY SIGNIFICANTLY AFFECT YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT</p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Initial Dispute Resolution</h3>
          <p>
            For any problem or dispute that you may have with us, you acknowledge and agree that you will first give MaticsApp an opportunity to resolve your problem or dispute. In order to initiate this dispute resolution process, you must first send us a written description of your problem or dispute within thirty (30) days of the occurrence of the event giving rise to the dispute by sending an email to <a href="mailto:support@maticsapp.com" className="text-blue-600 hover:underline">support@maticsapp.com</a>. You then agree to negotiate with us in good faith about the dispute for at least sixty (60) days after our receipt of your written description of it.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Binding Arbitration</h3>
          <p>
            If the parties do not reach an agreed upon solution within a period of 30 days from the time informal dispute resolution under the Initial Dispute Resolution provision, then either party may initiate binding arbitration as the sole means to resolve claims, subject to the terms set forth below. Specifically, all claims arising out of or relating to these Terms (including their formation, performance and breach), the parties&apos; relationship with each other and/or your use of the Service shall be finally settled by binding arbitration administered by the American Arbitration Association in accordance with the provisions of its Commercial Arbitration Rules and the supplementary procedures for consumer related disputes of the American Arbitration Association (the &ldquo;AAA&rdquo;), excluding any rules or procedures governing or permitting class actions.
          </p>
          <p>
            The arbitrator, and not any federal, state or local court or agency, shall have exclusive authority to resolve all disputes arising out of or relating to the interpretation, applicability, enforceability or formation of these Terms, including, but not limited to any claim that all or any part of these Terms are void or voidable, or whether a claim is subject to arbitration. The arbitrator shall be empowered to grant whatever relief would be available in a court under law or in equity. The arbitrator&apos;s award shall be written, and binding on the parties and may be entered as a judgment in any court of competent jurisdiction.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Class Action Waiver</h3>
          <p>
            The parties further agree that any arbitration shall be conducted in their individual capacities only and not as a class action or other representative action, and the parties expressly waive their right to file a class action or seek relief on a class basis. YOU AND MATICSAPP AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING. If any court or arbitrator determines that the class action waiver set forth in this paragraph is void or unenforceable for any reason or that an arbitration can proceed on a class basis, then the arbitration provision set forth above shall be deemed null and void in its entirety and the parties shall be deemed to have not agreed to arbitrate disputes.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">Exception &ndash; Litigation of Intellectual Property and Small Claims Court Claims</h3>
          <p>
            Notwithstanding the parties&apos; decision to resolve all disputes through arbitration, either party may bring an action in state or federal court to protect its intellectual property rights (&ldquo;intellectual property rights&rdquo; means patents, copyrights, moral rights, trademarks, and trade secrets, but not privacy or publicity rights). Either party may also seek relief in a small claims court for disputes or claims within the scope of that court&apos;s jurisdiction.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-8">30-Day Right to Opt-Out</h3>
          <p>
            You have the right to opt-out and not be bound by the arbitration and class action waiver provisions set forth above by sending written notice of your decision to opt-out to us at <a href="mailto:legal@maticsapp.com" className="text-blue-600 hover:underline">legal@maticsapp.com</a>. The notice must be sent within 30 days of your first use of the Service, otherwise you shall be bound to arbitrate disputes in accordance with the terms of those paragraphs. If you opt-out of these arbitration provisions, we also will not be bound by them.
          </p>

          {/* 16. Assignment */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">16. Assignment</h2>
          <p>
            This Agreement is personal to User and you may not assign, transfer, sublicense, subcontract, charge or otherwise encumber any of your rights or obligations under this Agreement without the prior written consent of MaticsApp. Any assignment in violation of this section shall be null and void. MaticsApp may assign, transfer, or delegate any of its rights and obligations hereunder without your consent.
          </p>

          {/* 17. No Third-Party Beneficiaries */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">17. No Third-Party Beneficiaries</h2>
          <p>
            The parties agree that except as otherwise expressly provided in these Terms, there shall be no third-party beneficiaries to the Terms.
          </p>

          {/* 18. Notice Policy */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">18. Notice Policy and Your Consent</h2>
          <p>
            Under these Terms you are contracting with Matics Lab INC, a Delaware corporation. All notices should be addressed to us at the address in the Contact section below.
          </p>
          <p>
            You acknowledge and agree that we may give you notice by means of a general notice on the Services, electronic mail to your email address in your account, text message, or by written communication sent by first class mail or pre-paid post to your address in your account. Such notice shall be deemed to have been given upon the expiration of 48 hours after mailing or posting (if sent by first class mail or pre-paid post) or 12 hours after sending (if sent by email or text). You may give notice to us, with such notice deemed given when received by us, at any time by first class mail or pre-paid post to the address set forth in the Contact section or at such other address as we may advise from time to time, pursuant to this provision.
          </p>

          {/* 19. Governing Law */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">19. Governing Law</h2>
          <p>
            These Terms (and any further rules, policies, or guidelines incorporated by reference) shall be governed by and construed in accordance with the laws of the State of Delaware and the United States, without giving effect to any principles of conflicts of law, and without application of the Uniform Computer Information Transaction Act or the United Nations Convention of Controls for International Sale of Goods.
          </p>
          <p>
            You agree that MaticsApp and its Services are deemed passive and do not give rise to personal jurisdiction over MaticsApp or its parents, subsidiaries, affiliates, successors, assigns, employees, agents, directors, officers or shareholders, either specific or general, in any jurisdiction other than the State of Delaware. You agree that any action at law or in equity arising out of or relating to these Terms, or your use or non-use of the Services, shall be filed only in the state or federal courts located in the State of Delaware and you hereby consent and submit to the personal jurisdiction of such courts for the purposes of litigating any such action. YOU IRREVOCABLY WAIVE ANY RIGHT YOU MAY HAVE TO TRIAL BY JURY IN ANY DISPUTE, ACTION, OR PROCEEDING.
          </p>

          {/* 20. Entire Agreement */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">20. Entire Agreement and Severability</h2>
          <p>
            These Terms and other referenced material constitute the entire agreement between you and us with respect to the Services, and supersede all prior or contemporaneous agreements, representations, warranties, and understandings (whether oral, written or electronic) between you and us with respect to the Services and govern the future relationship. If a court in any final, unappealable proceeding holds any provision of these Terms or its application to any person or circumstance invalid, illegal or unenforceable, the remainder of these Terms shall not be affected and shall be valid, legal, and enforceable to the fullest extent permitted by law.
          </p>

          {/* 21. Modification */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">21. Modification of Terms</h2>
          <p>
            We reserve the right, at our sole discretion, to modify the Services, Terms, and/or Privacy Policy from time to time. If changes to the Terms or Privacy Policy occur, we will notify you by posting the updated terms on the Site, or by email to the email affiliated with your account. Your continued use of the Services following the posting of such changes means you acknowledge and accept those changes and agree to be bound by the new terms and conditions. If you object to such changes, you must stop using the Services.
          </p>

          {/* 22. No Waiver */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">22. No Waiver</h2>
          <p>
            The failure of either party to exercise in any respect any right provided for herein shall not be deemed a waiver of any further rights hereunder.
          </p>

          {/* 23. Contact */}
          <h2 className="text-2xl font-bold text-gray-900 mt-12">23. Contact</h2>
          <p>
            If you have any questions regarding these Terms, please contact us at <a href="mailto:legal@maticsapp.com" className="text-blue-600 hover:underline">legal@maticsapp.com</a> or by mail at:
          </p>
          <div className="mt-4 bg-gray-50 rounded-lg p-6 text-sm">
            <p className="font-semibold">Matics Lab INC</p>
            <p className="mt-1">Email: <a href="mailto:legal@maticsapp.com" className="text-blue-600 hover:underline">legal@maticsapp.com</a></p>
            <p>General Support: <a href="mailto:support@maticsapp.com" className="text-blue-600 hover:underline">support@maticsapp.com</a></p>
            <p>Website: <a href="https://maticsapp.com" className="text-blue-600 hover:underline">https://maticsapp.com</a></p>
          </div>

          <p className="uppercase font-medium text-sm mt-8">
            I HEREBY ACKNOWLEDGE THAT I HAVE READ AND UNDERSTAND THIS AGREEMENT AND THE PRIVACY POLICY, AND AGREE THAT MY USE OF THE SERVICES IS AN ACKNOWLEDGMENT OF MY AGREEMENT TO BE BOUND BY ALL OF THE TERMS AND CONDITIONS OF THIS AGREEMENT.
          </p>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Matics Lab INC. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors font-medium text-gray-900">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
