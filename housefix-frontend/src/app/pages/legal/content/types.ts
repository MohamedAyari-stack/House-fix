/**
 * Documents légaux (politique de confidentialité, conditions d'utilisation), un fichier par langue.
 * Un paragraphe est une chaîne ; une liste à puces est un tableau de chaînes.
 * Les sections gardent les mêmes `id` dans toutes les langues (ancres du sommaire).
 */
export type LegalBlock = string | string[];

export interface LegalSection {
  id: string;
  title: string;
  body: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalTexts {
  privacy: LegalDoc;
  terms: LegalDoc;
}

/**
 * Version des documents : à changer à chaque modification de fond. Elle est enregistrée avec l'acceptation
 * de l'utilisateur à l'inscription (users.terms_version) et doit correspondre à config('app.terms_version').
 */
export const LEGAL_VERSION = '2026-10-11';

/** Coordonnées de l'exploitant, citées dans les documents. À remplacer par les informations réelles. */
export const OPERATOR = {
  name: 'DarFix',
  email: 'contact@housefix.tn',
};
