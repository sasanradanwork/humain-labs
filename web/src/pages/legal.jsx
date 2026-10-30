import { SITE } from "../lib/site.js";

// Drafts for review. They describe how the platform actually works; have a solicitor
// check them against your company details, retention periods and any fees before launch.

function LegalPage({ title, children }) {
  return (
    <article className="wrap legal">
      <p className="eyebrow">Last updated {SITE.lastUpdated}</p>
      <h1>{title}</h1>
      {children}
    </article>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms and conditions">
      <p>
        These terms apply when you use HumAIn Labs, the website at this address. They are an agreement between you and {SITE.legalName}, registered
        at {SITE.address} (company number {SITE.companyNumber}). By creating an account or using the site, you agree to them.
      </p>

      <h2>1. What HumAIn Labs is</h2>
      <p>
        HumAIn Labs is a platform where researchers post studies and invite participants to apply, and where researchers publish profiles and research
        groups. We provide the platform. We do not run, sponsor or approve the studies posted on it, and we are not a party to any agreement between a
        researcher and a participant.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You sign in with a Microsoft or GitHub account. You're responsible for keeping that account secure.</li>
        <li>You must give accurate information and keep it up to date.</li>
        <li>An account may have one researcher profile. Participants can apply to studies from a separate, participant account.</li>
      </ul>

      <h2>3. Participants</h2>
      <ul>
        <li>Applying to a study is voluntary. Before you apply, read what the study involves and who it is for.</li>
        <li>When you apply, you agree that the researcher may contact you about that study, and you can withdraw that consent at any time.</li>
        <li>You can ask a researcher to remove your application, or contact us if you need help doing so.</li>
      </ul>

      <h2>4. Researchers</h2>
      <p>If you post studies, create groups or publish a profile, you agree that:</p>
      <ul>
        <li>you are a genuine researcher, and the details you publish are accurate;</li>
        <li>
          you have any ethics approval, consent process and data protection arrangements that your study needs, and you comply with your institution's and
          the law's rules for research with people;
        </li>
        <li>you use participants' details only for the study they applied to, and you delete them when you no longer need them;</li>
        <li>you won't post studies that are misleading, that ask for payment from participants, or that could put people at risk;</li>
        <li>you'll tell participants promptly if a study closes early, changes significantly or is cancelled.</li>
      </ul>

      <h2>5. Verification</h2>
      <p>
        A verified badge means you confirmed control of an email address at the institution shown. It does not mean we have checked your qualifications,
        employment or research approvals. Only verified researchers can post studies. A badge is removed if the institution on your profile changes.
      </p>

      <h2>6. Content you post</h2>
      <p>
        You keep ownership of what you post. You give us a licence to display it on HumAIn Labs and to show it to other users, for as long as it is on the
        site. We may remove or restrict content that breaks these terms or the law.
      </p>

      <h2>7. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>impersonate anyone, or create fake profiles, studies or reviews;</li>
        <li>scrape, copy in bulk or harvest contact details from the site;</li>
        <li>send unsolicited marketing, or use participants' details for anything other than the study they applied to;</li>
        <li>try to access another person's account, data or applications, or interfere with the site's operation;</li>
        <li>post anything unlawful, abusive or discriminatory.</li>
      </ul>

      <h2>8. Information from outside services</h2>
      <p>
        Publication figures come from OpenAlex, and institution details come from the Research Organization Registry (ROR). We show them as provided and
        cannot guarantee they are complete or correct. Google Scholar profiles are shown as links only.
      </p>

      <h2>9. Fees</h2>
      <p>[State here whether any fees apply. Delete this paragraph if the platform is free to use.]</p>

      <h2>10. Our liability</h2>
      <p>
        The platform is provided as it is. To the extent the law allows, we are not liable for losses arising from studies posted by researchers, from
        participation in any study, or from interruptions to the site. Nothing in these terms limits liability for death or personal injury caused by
        negligence, for fraud, or for anything else that cannot be limited by law. [Insert any financial cap on liability your solicitor recommends.]
      </p>

      <h2>11. Ending your account</h2>
      <p>
        You can stop using HumAIn Labs at any time. We may suspend or end an account that breaks these terms, and will tell you why where we can. Some
        information may be kept after an account ends, as explained in our privacy policy.
      </p>

      <h2>12. Changes</h2>
      <p>We may update these terms. If the change is significant, we'll tell you on the site before it takes effect.</p>

      <h2>13. Law</h2>
      <p>These terms are governed by the law of {SITE.governingLaw}. The courts of {SITE.governingLaw} have jurisdiction, subject to any rights you have as a consumer.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
      </p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains what personal information HumAIn Labs collects, why, and what you can do about it. {SITE.legalName} is the controller of the
        information described here. Contact us at <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Sign-in.</strong> Your name and email address from your Microsoft or GitHub account. We never see your password.
        </li>
        <li>
          <strong>Participant applications.</strong> Name, email address, age, country, any note you add, and your consent to be contacted by the
          researcher of the study you applied to.
        </li>
        <li>
          <strong>Researcher profiles.</strong> Name, handle, institution, country, field, contact email, a short bio, and optional LinkedIn, Google Scholar
          and ORCID links.
        </li>
        <li>
          <strong>Verification.</strong> The institution email address you verify with. We email you a six-digit code and store only a salted hash of it,
          not the code itself. Codes expire after 15 minutes.
        </li>
        <li>
          <strong>Research groups and studies.</strong> The details you enter, including group members who are registered researchers on the platform.
        </li>
        <li>
          <strong>Publication figures.</strong> If you add an ORCID iD, we look up your public publication and citation figures from OpenAlex and store
          them on your profile.
        </li>
        <li>
          <strong>Site preferences and cookies.</strong> We store your light or dark mode choice in your browser. We use only the session cookies that
          keep you signed in. We don't use advertising or tracking cookies.
        </li>
      </ul>

      <h2>2. Why we use it and the legal basis</h2>
      <ul>
        <li>To run the service you ask for, such as sending an application or publishing a profile (contract).</li>
        <li>To send your application to the researcher, where you have agreed to be contacted (consent, which you can withdraw at any time).</li>
        <li>To verify researchers, keep the site secure and prevent misuse (legitimate interests).</li>
        <li>Where the law requires us to keep or disclose information (legal obligation).</li>
      </ul>

      <h2>3. Who can see your information</h2>
      <ul>
        <li>
          <strong>Public.</strong> Researcher profiles, group pages and open studies are visible to anyone who visits the site, limited to what you publish.
        </li>
        <li>
          <strong>Researchers.</strong> A researcher can see the applicants to their own studies, and nothing about applicants to anyone else's studies.
        </li>
        <li>
          <strong>Us.</strong> Our staff can access data to run, support and secure the service.
        </li>
        <li>
          <strong>Service providers.</strong> Microsoft Azure hosts the site, database and email. Microsoft and GitHub handle sign-in. OpenAlex receives the
          ORCID iD you add. The ROR registry receives what you type when you search for an institution.
        </li>
      </ul>
      <p>We don't sell your information.</p>

      <h2>4. Where it is stored</h2>
      <p>
        Data is stored in Microsoft Azure data centres. The database and email data are held in the United Kingdom. The website and API are hosted in the
        Azure region chosen when the service was set up, which may be in Europe or the United States. Where data leaves the UK, it is protected by the
        safeguards Microsoft provides. [Confirm the hosting region before launch.]
      </p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li>Participant applications: [set the period, for example 12 months after the study closes]. Then they are deleted.</li>
        <li>Researcher profiles, groups and studies: until you delete them or close your account.</li>
        <li>Verification codes: deleted when they expire or are used.</li>
        <li>Server logs: [set the period].</li>
      </ul>

      <h2>6. Your rights</h2>
      <p>
        You can ask us for a copy of your information, ask us to correct or delete it, object to some uses, ask us to restrict use, and withdraw consent
        at any time. Email <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>. We'll respond within one month. You can also complain to the
        Information Commissioner's Office at ico.org.uk.
      </p>

      <h2>7. Participants and under-18s</h2>
      <p>
        Participants must be at least 16 to apply. Some studies require adults. Researchers set each study's eligibility. We don't knowingly collect
        information from anyone under 16. If you think we have, contact us and we'll delete it.
      </p>

      <h2>8. Research data</h2>
      <p>
        HumAIn Labs passes applications to researchers. What a researcher does with that information afterwards is governed by the researcher's own
        privacy notice and data protection arrangements, and their ethics approval.
      </p>

      <h2>9. Changes</h2>
      <p>We'll update this policy when our practices change, and tell you on the site when a change is significant.</p>

      <h2>Contact</h2>
      <p>
        {SITE.legalName}, {SITE.address}. <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>
      </p>
    </LegalPage>
  );
}

