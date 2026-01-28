export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="bg-white rounded-lg shadow p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              By accessing or using Matics, you agree to be bound by these Terms of Service
              and all applicable laws and regulations. If you do not agree with any of these
              terms, you are prohibited from using this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Use of Service</h2>
            <p className="text-gray-600 leading-relaxed">
              You may use our service only for lawful purposes and in accordance with these Terms.
              You agree not to use the service in any way that could damage, disable, or impair
              the service or interfere with any other party&apos;s use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">User Accounts</h2>
            <p className="text-gray-600 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You agree to notify us
              immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Intellectual Property</h2>
            <p className="text-gray-600 leading-relaxed">
              The service and its original content, features, and functionality are owned by
              Matics and are protected by international copyright, trademark, and other
              intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">
              In no event shall Matics be liable for any indirect, incidental, special,
              consequential, or punitive damages arising out of or related to your use of
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:support@maticsapp.com" className="text-blue-600 hover:underline">
                support@maticsapp.com
              </a>
            </p>
          </section>
        </div>

        <p className="text-center text-gray-500 text-sm mt-8">
          Last updated: January 2026
        </p>
      </div>
    </div>
  )
}
