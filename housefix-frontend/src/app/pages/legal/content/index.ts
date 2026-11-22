import { Lang } from '../../../i18n/i18n';
import { LEGAL_AR } from './ar';
import { LEGAL_EN } from './en';
import { LEGAL_FR } from './fr';
import { LegalTexts } from './types';

export const LEGAL: Record<Lang, LegalTexts> = { fr: LEGAL_FR, ar: LEGAL_AR, en: LEGAL_EN };
export { LEGAL_VERSION, OPERATOR } from './types';
export type { LegalBlock, LegalDoc, LegalSection } from './types';
