import type { accueil as fr } from '../fr/accueil';

export const accueil: typeof fr = {
  homeAria: 'DarFix, home',
  nav: {
    services: 'Services',
    howItWorks: 'How it works',
    providers: 'Providers',
    reviews: 'Reviews',
    login: 'Sign in',
    register: 'Create an account',
    openMenu: 'Open menu',
  },
  hero: {
    eyebrow: 'All across Tunisia',
    titleStart: 'Trusted tradespeople,',
    titleAccent: 'close to home.',
    lead: 'Plumbing, electrical, air conditioning, locksmithing… Find a verified service provider, book online and track your job all the way to the invoice.',
    findProvider: 'Find a provider',
    becomeProvider: 'Become a provider',
    points: {
      free: 'Free sign-up',
      validated: 'Approved providers',
      payment: 'Pay online or in cash',
    },
    mockTitle: 'Recommended providers',
    new: 'New',
    chipConfirmed: 'Appointment confirmed',
    chipPaid: 'Payment received',
  },
  stats: {
    aria: 'DarFix in numbers',
    providers: 'verified providers',
    interventions: 'jobs completed',
    rating: 'average client rating',
    rating5: '{note}/5',
    gouvernorats: 'governorates covered',
  },
  services: {
    eyebrow: 'Services',
    title: 'An expert for every home need',
    providersOne: '{count} provider',
    providersMany: '{count} providers',
  },
  guides: {
    watchStep: 'Watch the video',
    title: 'Video guides',
    lead: 'Not sure how it works? Watch our short demos recorded on DarFix, all under 40 seconds.',
    duration: '{s} s',
    close: 'Close the video',
    note: 'Recorded on DarFix (interface shown in French; switch language from the menu).',
    items: {
      reserver: 'How to book an appointment',
      payer: 'How to pay an invoice',
      verifie: 'How providers are verified',
      prix: 'How to check prices',
    },
  },
  how: {
    eyebrow: 'How it works',
    title: 'Your job in 3 steps',
    steps: {
      find: {
        title: 'Find',
        text: 'Choose a service and compare verified providers in your governorate: rating, rate, distance.',
      },
      book: {
        title: 'Book',
        text: 'Send your request with the date and address. The provider confirms or suggests another time.',
      },
      pay: {
        title: 'Pay and review',
        text: 'Pay online or in cash after the job, then rate the work to help other clients.',
      },
    },
  },
  top: {
    eyebrow: 'Providers',
    title: 'Top rated right now',
    seeAll: 'See all providers',
    experience: '{count} yrs experience',
    newOnDarFix: 'New on DarFix',
  },
  reviews: {
    eyebrow: 'Reviews',
    title: 'What our clients say',
    quote: '“{text}”',
  },
  guarantees: {
    eyebrow: 'Why DarFix',
    title: 'A platform built on trust',
    verified: {
      title: 'Verified providers',
      text: 'Every professional account is approved by our team before it can receive requests.',
    },
    invoices: {
      title: 'Clear invoices',
      text: 'A PDF invoice for every job, with a full price breakdown.',
    },
    messaging: {
      title: 'Built-in messaging',
      text: 'Chat with the provider without sharing your phone number.',
    },
    disputes: {
      title: 'Tracked disputes',
      text: 'A problem? Report it: our admin team follows every dispute through to resolution.',
    },
  },
  cta: {
    title: 'Are you a tradesperson or technician?',
    text: 'Get requests near you and manage your calendar and invoices in one place.',
    button: 'Join DarFix',
  },
  footer: {
    copyright: '© {year} DarFix. Home services in Tunisia.',
  },
};
