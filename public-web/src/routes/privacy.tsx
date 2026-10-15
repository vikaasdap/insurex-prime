import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — InsuroX Prime" },
      {
        name: "description",
        content:
          "How InsuroX Prime collects, uses and protects your information, including Google Calendar data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <p>
          InsuroX Prime ("we", "us") provides software that insurance agencies and their agents use
          to manage customers, policies, sales, meetings and follow-ups. This policy explains what
          information we handle, why, and the choices you have. It applies to the InsuroX Prime
          website and the InsuroX Prime agent and admin portals.
        </p>
      </section>

      <section>
        <h2>Information we handle</h2>
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address, phone number and role (agent
            or administrator), provided by your agency when your account is created.
          </li>
          <li>
            <strong>Agency records:</strong> customer, policy, receipt, sales-goal, meeting and
            follow-up note information that you or your agency enter into InsuroX Prime.
          </li>
          <li>
            <strong>Usage and device data:</strong> basic logs (such as sign-in times and errors)
            and, if you turn on phone alerts, the push-notification address of your browser or
            device.
          </li>
          <li>
            <strong>Google Calendar data</strong>, only if you choose to connect it (see below).
          </li>
        </ul>
      </section>

      <section>
        <h2>Google Calendar integration</h2>
        <p>
          InsuroX Prime offers an optional feature that syncs your InsuroX Prime meetings with your
          own Google Calendar. It is off until you click "Connect Google Calendar" and approve
          access on Google's consent screen.
        </p>
        <p>
          <strong>What we access.</strong> We ask for the Google permission to view and edit events
          on your calendars (<code>calendar.events</code>), plus your email address so we can show
          which Google account is connected. Through it we read and write event titles,
          descriptions, start and end times, and meeting links.
        </p>
        <p>
          <strong>How we use it.</strong> Only to provide the sync you asked for: meetings you
          create in InsuroX Prime are added to your Google Calendar, and changes or new events you
          make in Google Calendar appear in your InsuroX Prime calendar. We do not use your Google
          data for advertising, do not sell it, and do not use it to train AI or machine-learning
          models.
        </p>
        <p>
          <strong>How we store it.</strong> We keep a Google refresh token so sync can continue,
          encrypted at rest. Events imported from Google are stored as meetings in your agency's
          InsuroX Prime account. Meeting details are visible only to you, the people invited to that
          meeting, and your agency's administrators, as for any InsuroX Prime meeting.
        </p>
        <p>
          <strong>Sharing.</strong> We do not share your Google user data with third parties, except
          as needed to run the service (our hosting and database providers, who process it on our
          behalf), when required by law, or with your consent.
        </p>
        <p>
          <strong>Disconnecting and deleting.</strong> You can disconnect at any time with the
          disconnect button on the Calendar page, which revokes our access and deletes the stored
          token. You can also remove access in your Google Account at{" "}
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
          Events already copied to either calendar stay there; to have imported meetings deleted
          from InsuroX Prime, contact us at the address below.
        </p>
        <p>
          InsuroX Prime's use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy#limited-use">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>To run the InsuroX Prime service for your agency and keep your account secure.</li>
          <li>
            To send meeting invitations, follow-up reminders and (if enabled) phone alerts you would
            expect from the service.
          </li>
          <li>To fix problems, prevent misuse and meet legal obligations.</li>
        </ul>
        <p>We do not sell personal information.</p>
      </section>

      <section>
        <h2>Who sees your information</h2>
        <p>
          Records belong to your agency. Within the agency, access depends on role: administrators
          can see their agency's data; agents see the records they are responsible for. Data of one
          agency is kept separate from other agencies. We use trusted infrastructure providers for
          hosting, database, email delivery and notifications, which process data only on our
          instructions.
        </p>
      </section>

      <section>
        <h2>Security and retention</h2>
        <p>
          We use encryption in transit, encryption of stored Google tokens, role-based access and
          audit logging. We keep information for as long as your agency's account is active or as
          needed to provide the service and meet legal duties, then delete or anonymise it.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>
          You can ask us to access, correct or delete your personal information, or withdraw a
          consent you gave, by contacting us. Because records belong to your agency, some requests
          may be handled together with your agency administrator.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>InsuroX Prime is a business tool and is not directed to children under 18.</p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy. The date at the top shows when it last changed, and we will
          highlight material changes in the product or by email.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions or requests about privacy:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
