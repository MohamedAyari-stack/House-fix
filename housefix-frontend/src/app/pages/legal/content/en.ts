import { LegalTexts, OPERATOR } from './types';

/** English version. Follows exactly the same structure as the French source (fr.ts). */
export const LEGAL_EN: LegalTexts = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'This policy explains what personal data DarFix collects, why, who it is shared with, and how to exercise your rights. It applies to everyone who uses the platform, whether as a client, a service provider, or an administrator.',
    sections: [
      {
        id: 'responsable',
        title: 'Data controller',
        body: [
          `Your data is processed by ${OPERATOR.name}, which operates the platform connecting clients with home-service providers in Tunisia.`,
          `For any question about your data: ${OPERATOR.email}.`,
          'Processing complies with Organic Law No. 2004-63 of 27 July 2004 on the protection of personal data.',
        ],
      },
      {
        id: 'donnees',
        title: 'Data we collect',
        body: [
          'We collect only the data needed to run the service:',
          [
            'Account: name, email address, phone number, governorate, password (stored in encrypted form, never readable), interface language, date your email was verified, and date you accepted these terms.',
            'Profile (optional): photo, address, geographic location (latitude and longitude).',
            "Service providers' professional profile: trade, specialty, description, years of experience, certifications, hourly rate, availability, validation status.",
            'Appointments: date, time, description of the need, address and location of the job, status.',
            'Invoices and payments: amount, payment method, status. For bank card payments, only the last 4 digits of the card are kept; the full card number is never stored.',
            'Communications: messages between client and provider, reviews and replies, disputes and administration decisions, notifications.',
            'Technical data: login token, IP address and browser during sessions, server error logs.',
          ],
          'Your GPS location is read only with your consent (browser prompt) to calculate distances; it is stored only if you add it to your profile or to an appointment.',
        ],
      },
      {
        id: 'finalites',
        title: 'Why we use your data',
        body: [
          [
            'To create and secure your account (email verification by code, password reset).',
            'To connect clients and providers: search, booking appointments, messaging, invoices, payments.',
            'To validate provider accounts and moderate reviews and disputes.',
            'To send you emails and notifications related to your activity (appointments, invoices, accounts, disputes), in your language.',
            'To recommend providers suited to your needs (see the next section).',
            'To keep the platform secure and prevent abuse (blocking accounts, limiting attempts).',
          ],
          'We do not sell your data and do not use it for advertising.',
        ],
      },
      {
        id: 'recommandation',
        title: 'AI-powered recommendations',
        body: [
          'To suggest providers, a recommendation service calculates a score based on explicit criteria: how well they match the need you describe, client ratings, distance, rate, reliability, experience, and your past appointments. The reasons behind each recommendation are shown to you.',
          "This service receives providers' professional information and your context (governorate, location if you have shared it, history of your completed appointments); it does not receive your name, email address, or phone number.",
          'Recommendations are only an aid to your choice: you remain free to choose any provider, and they do not lead to any automated decision about you.',
        ],
      },
      {
        id: 'partage',
        title: 'Who can see your data',
        body: [
          [
            'The provider you book an appointment with sees the information needed for the job: name, phone number, address, and description of the need.',
            'Clients see the public profile of validated providers: name, photo, trade, description, rate, governorate, rating, and reviews.',
            "On the public home page, reviews are displayed with only the author's first name and last initial.",
            'DarFix administrators access the data needed to validate accounts, moderate content, and handle disputes.',
            'An email delivery provider sends emails on our behalf (email address, name, and message content).',
          ],
          'Your data is disclosed to authorities only when required by law.',
        ],
      },
      {
        id: 'conservation',
        title: 'How long we keep your data',
        body: [
          [
            'Account data is kept for as long as the account exists.',
            'Verification codes are deleted as soon as they are used and expire after 15 minutes.',
            'Invoices are kept for the period required by accounting and tax obligations.',
            'When an account is deleted, personal data is erased, except data that the law requires us to keep.',
          ],
        ],
      },
      {
        id: 'securite',
        title: 'Security',
        body: [
          [
            'Passwords and verification codes are stored only in encrypted form.',
            'Email address verification at sign-up and a one-time code to reset your password.',
            'Limits on the number of login attempts and code entries.',
            'Sign-out from all your devices after a password change.',
            'Data access restricted by role (client, provider, administrator).',
          ],
        ],
      },
      {
        id: 'stockage-local',
        title: 'Storage in your browser',
        body: [
          "DarFix does not use advertising cookies or audience measurement tools. Your browser stores only your login token, your profile, and your chosen language and theme, so you don't have to sign in again or redo your settings. This information is cleared when you sign out (except the language and theme).",
        ],
      },
      {
        id: 'droits',
        title: 'Your rights',
        body: [
          'Under Organic Law No. 2004-63, you have the following rights:',
          [
            'Access: obtain a copy of the data concerning you.',
            'Rectification: correct your data. Most of it can be edited directly in Settings.',
            'Objection: object, on legitimate grounds, to the processing of your data.',
            'Deletion: request the deletion of your account and your data.',
          ],
          `To exercise these rights, write to ${OPERATOR.email} from your account's email address. You can also file a complaint with the National Authority for the Protection of Personal Data (INPDP).`,
        ],
      },
      {
        id: 'mineurs',
        title: 'Minors',
        body: ['The platform is intended for adults. We do not knowingly collect data about minors.'],
      },
      {
        id: 'modifications',
        title: 'Changes to this policy',
        body: [
          'We may update this policy. The date of the last update appears at the top of the page; if there is a significant change, you will be informed by email or by a notification.',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms of Use',
    intro:
      'These terms govern the use of DarFix. By creating an account, you accept them, as well as the Privacy Policy. If you do not accept them, do not use the platform.',
    sections: [
      {
        id: 'objet',
        title: 'Purpose of the service',
        body: [
          'DarFix is a platform that connects clients with home-service providers (plumbing, electrical work, air conditioning, locksmithing, carpentry, painting, gardening, cleaning, and more) in Tunisia.',
          'DarFix acts as a technical intermediary: the service contract is concluded directly between the client and the provider. DarFix is not a party to that contract and does not perform the jobs.',
        ],
      },
      {
        id: 'compte',
        title: 'Account creation and security',
        body: [
          [
            'Registration is free and limited to adults.',
            'You must provide accurate information and verify your email address using the code you receive.',
            'You are responsible for keeping your password confidential and for the activity on your account. Let us know about any unauthorized use.',
            'An account is personal and cannot be transferred.',
          ],
        ],
      },
      {
        id: 'prestataires',
        title: 'Service provider obligations',
        body: [
          [
            'A provider account appears in search results only after it has been validated by the administration. This validation covers the consistency of the profile; it does not guarantee the quality of the work.',
            'Providers describe their skills, experience, certifications, and rates honestly.',
            'They work in compliance with the regulations applicable to their activity (permits, insurance, tax obligations) and remain solely responsible for their jobs.',
            'They respond to requests within a reasonable time, honor accepted appointments, and issue an invoice that matches the job performed.',
          ],
        ],
      },
      {
        id: 'rendez-vous',
        title: 'Appointments',
        body: [
          [
            'The client sends a request with the date, address, and description of the need; the provider accepts it, declines it, or proposes another time.',
            'The client can cancel an appointment while it is pending or accepted, that is, before the job is marked as completed.',
            'Once the job is completed, the provider issues the invoice through the platform.',
          ],
        ],
      },
      {
        id: 'paiement',
        title: 'Rates and payment',
        body: [
          [
            "The hourly rate shown by the provider is for guidance only; the amount due is the amount on the invoice.",
            'The invoice can be paid online by bank card or in cash. Cash payments are confirmed by the provider.',
            'Registering for and using the platform are free for clients.',
          ],
        ],
      },
      {
        id: 'avis',
        title: 'Reviews and ratings',
        body: [
          [
            'Only a client whose job has been completed can review the provider.',
            'Reviews must be honest, respectful, and about the job. The provider can reply to them.',
            'The administration may remove a review that is abusive, defamatory, off-topic, or misleading.',
          ],
        ],
      },
      {
        id: 'messagerie',
        title: 'Messaging',
        body: [
          'Messaging is for communications related to services. Using it for solicitation, harassment, or unlawful content is prohibited.',
        ],
      },
      {
        id: 'litiges',
        title: 'Disputes',
        body: [
          "If a problem arises with an appointment, the client and the provider can open a dispute through the platform. The administration reviews the situation and may propose a solution, without replacing the parties' legal remedies.",
        ],
      },
      {
        id: 'comportements',
        title: 'Prohibited conduct',
        body: [
          [
            'Providing false information or impersonating another person.',
            'Posting abusive, discriminatory, defamatory, or unlawful content.',
            'Bypassing the platform to avoid an invoice already incurred, or manipulating reviews.',
            "Attempting to disrupt the service or to access other users' data.",
          ],
        ],
      },
      {
        id: 'sanctions',
        title: 'Account suspension and deletion',
        body: [
          'If these terms are breached, the administration may block an account temporarily or permanently, giving the user the reason, or even delete it. You can request the deletion of your account at any time (see the Privacy Policy).',
        ],
      },
      {
        id: 'ia',
        title: 'Recommendations',
        body: [
          'Recommended providers and their match score are calculated automatically, for guidance only. They are neither a guarantee nor an official ranking; the choice of provider is yours.',
        ],
      },
      {
        id: 'responsabilite',
        title: 'Liability',
        body: [
          'DarFix makes every effort to ensure the availability and security of the platform, but cannot guarantee uninterrupted operation. DarFix is not responsible for the performance, quality, or consequences of services carried out by providers.',
        ],
      },
      {
        id: 'propriete',
        title: 'Intellectual property',
        body: [
          'The platform (name, logo, interface, code) belongs to its operator. You retain the rights to the content you post (photos, descriptions, reviews) and authorize DarFix to display it on the platform for the purposes of the service.',
        ],
      },
      {
        id: 'donnees',
        title: 'Personal data',
        body: ['The processing of your data is described in the Privacy Policy, which forms part of these terms.'],
      },
      {
        id: 'modifications',
        title: 'Changes to the terms',
        body: [
          'These terms may change. The date of the last update appears at the top of the page; if there is a significant change, users are informed and may be asked to accept them again.',
        ],
      },
      {
        id: 'droit',
        title: 'Governing law',
        body: [
          `These terms are governed by Tunisian law. In the event of a disagreement, the parties will first seek an amicable solution; failing that, the matter will be brought before the competent Tunisian courts. Contact: ${OPERATOR.email}.`,
        ],
      },
    ],
  },
};
