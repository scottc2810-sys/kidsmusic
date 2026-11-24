// Privacy policy and terms of use, readable without signing in (/privacy, /terms) and linked from sign-up.
// They describe what Melo really does with data (see docs/REVIEW.md). DRAFTS: have a lawyer review both before
// selling, then fill SUPPORT_EMAIL and SELLER. When the text changes in substance, bump the version here AND in
// backend/app/legal.py so parents accept it again.
import { Link } from "react-router-dom";

export const PRIVACY_VERSION = "2026-11-24";
export const TERMS_VERSION = "2026-11-24";
/** Filled in before launch: the address parents write to, and who sells Melo. */
export const SUPPORT_EMAIL = "";
export const SELLER = "the seller of Melo";
/** The shop page where parents buy the family plan (a licence key arrives by email). */
export const BUY_URL = "";

const contact = () => (SUPPORT_EMAIL
  ? <>by email to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></>
  : <>through the website where you got Melo</>);

function LegalShell({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <main className="legal-page">
      <article className="card">
        <h1>{title}</h1>
        <p className="muted small">Effective {version}</p>
        {children}
        <p className="small"><Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Use</Link> · <Link to="/login">Back to Melo</Link></p>
      </article>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" version={PRIVACY_VERSION}>
      <p><strong>In short:</strong> Melo keeps your family's information on your own computer. It shows no ads, has no
        tracking, and never sells data. Nothing about your child leaves the computer unless you turn on an online AI
        brain, and even then Melo never sends your child's name or voice.</p>

      <h2>Who this is for</h2>
      <p>Melo is a learning app for children aged about 3 to 10, used under the supervision of a parent or legal
        guardian. Only a parent or guardian may create an account, and they agree to this policy for their child.</p>

      <h2>What Melo stores, and where</h2>
      <ul>
        <li><strong>Parent account:</strong> email address and a protected (hashed) password.</li>
        <li><strong>Each child:</strong> first name or nickname, age, language choices, school class, progress, answers,
          stars and notes from lessons.</li>
        <li><strong>Recordings</strong> (only if you allow them): the child's playing or speaking, stored encrypted.</li>
        <li><strong>What you add:</strong> instrument photos and links, family phrases and recordings, chats with Melo.</li>
      </ul>
      <p>All of this is stored in Melo's folder on this computer. Melo runs its own small server that only this
        computer can reach.</p>

      <h2>When information leaves this computer</h2>
      <ul>
        <li><strong>An online AI brain, only if you choose one:</strong> the lesson context (for example the skill being
          practised and recent results) is sent to the AI service you picked, under that service's own terms. Melo
          replaces your child's name before sending and never sends audio. A local AI brain (such as Ollama) keeps
          everything on this computer; the built-in teacher works with no AI at all.</li>
        <li><strong>Voices and recordings Melo downloads:</strong> requests to public voice libraries and voice services
          contain the word or phrase being taught, never information about your child.</li>
        <li><strong>Links you add</strong> (for example an instrument's shop page) are read once to describe the
          instrument.</li>
        <li><strong>Update check:</strong> Melo may ask our download page whether a newer version exists; this sends no
          personal information.</li>
      </ul>

      <h2>Children's privacy</h2>
      <p>We collect children's information only through a parent's account and with the parent's consent. You choose
        whether Melo may use the microphone and keep recordings, for each child, and can change this at any time. We
        do not use children's information for advertising or profiling, and we do not share it with anyone except the
        AI service you choose, as described above. This approach follows the US Children's Online Privacy Protection
        Act (COPPA) and India's Digital Personal Data Protection Act, 2023.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>See your child's information and progress in the parent area at any time.</li>
        <li>Turn the microphone, recordings and the AI brain on or off per child.</li>
        <li>Delete a child, or delete your whole account with every child, recording and note, from Settings. Deleting
          removes the information from this computer.</li>
      </ul>

      <h2>How long we keep information</h2>
      <p>Until you delete it. Uninstalling Melo leaves your data folder in place so a reinstall keeps progress; delete
        your account first if you want it gone.</p>

      <h2>Contact</h2>
      <p>Questions or requests about privacy: contact {SELLER} {contact()}.</p>
      <p className="muted small">We will post any change to this policy here and ask you to accept it again when it
        changes in an important way.</p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Use" version={TERMS_VERSION}>
      <p>These terms are between you, the parent or guardian, and {SELLER}. By creating an account you accept them and
        the <Link to="/privacy">Privacy Policy</Link>.</p>
      <h2>Using Melo</h2>
      <ul>
        <li>Only a parent or legal guardian over 18 may create an account. Children use Melo with your supervision.</li>
        <li>Your licence lets your household use Melo on your own computers. Do not resell, copy for others or reverse
          engineer it, except where the law allows.</li>
        <li>A paid plan, if you buy one, gives the features described when you bought it, for the period you paid.</li>
      </ul>
      <h2>Learning content</h2>
      <p>Melo's lessons, translations and cultural content are made with care, partly with the help of AI, and are
        reviewed over time. They are for learning at home, not professional, medical or religious advice. Tell us
        about any mistake and we will fix it.</p>
      <h2>Recordings and voices</h2>
      <p>Native-speaker recordings are used under their open licences, with credit shown in the app. Recordings you
        make of your family stay on your computer.</p>
      <h2>No guarantee, limit of liability</h2>
      <p>Melo is provided as it is. To the extent the law allows, {SELLER} is not liable for indirect losses, and its
        total liability is limited to what you paid for Melo in the last 12 months. Nothing here limits rights you
        have under consumer law.</p>
      <h2>Changes and contact</h2>
      <p>We may update these terms and will ask you to accept important changes. Questions: contact {SELLER}{" "}
        {contact()}.</p>
    </LegalShell>
  );
}
