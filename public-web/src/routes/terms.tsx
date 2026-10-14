import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — InsuroX" },
      { name: "description", content: "The terms for using the InsuroX service." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <p>
          These terms govern your use of InsuroX, software for insurance agencies and agents. By
          using InsuroX you agree to them. If you use it on behalf of an agency, you confirm you are
          allowed to accept these terms for that agency.
        </p>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          InsuroX lets agencies manage customers, policies, sales, receipts, meetings and
          follow-ups, and optionally connect a Google Calendar. We may improve, change or
          discontinue features, and will try to give notice of material changes.
        </p>
      </section>

      <section>
        <h2>Accounts</h2>
        <p>
          Accounts are created by your agency. Keep your sign-in details confidential and tell us
          promptly if you think they have been misused. You are responsible for activity under your
          account.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>
            Use InsuroX only for lawful business purposes and in line with insurance rules that
            apply to you.
          </li>
          <li>
            Do not attempt to access other agencies' data, probe or disrupt the service, or misuse
            integrations.
          </li>
          <li>
            Only enter personal information you have the right to handle, and use it as your
            customers expect.
          </li>
        </ul>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          Records you or your agency enter remain yours. You give us permission to store and process
          them to run the service. How we handle personal information, including Google Calendar
          data, is described in our <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>Google Calendar</h2>
        <p>
          The Google Calendar sync is optional. Using it is also subject to Google's own terms. You
          can disconnect at any time from the Calendar page.
        </p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          We work to keep InsuroX available but do not guarantee uninterrupted or error-free
          service. We may suspend access that breaks these terms or puts the service or others at
          risk.
        </p>
      </section>

      <section>
        <h2>Disclaimer and liability</h2>
        <p>
          InsuroX is a record-keeping and productivity tool, not insurance, legal or financial
          advice. The service is provided "as is". To the extent the law allows, we are not liable
          for indirect or consequential loss, and our total liability is limited to the amount your
          agency paid for the service in the 12 months before the claim.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; continuing to use InsuroX after a change means you accept it.
          Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
