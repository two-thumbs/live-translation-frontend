export const LanguageEnum = {
  ENGLISH: 0,
  JAPANESE: 1,
  SIMPLIFIED_CHINESE: 2,
  TRADITIONAL_CHINESE: 3,
  VIETNAMESE: 4,
  THAI: 5,
  INDONESIAN: 6,
  FRENCH: 7,
  SPANISH: 8,
  RUSSIAN: 9,
  GERMAN: 10,
  ITALIAN: 11,
} as const;

export type LanguageEnum = (typeof LanguageEnum)[keyof typeof LanguageEnum];

export const languageOptions = Object.keys(LanguageEnum) as Array<
  keyof typeof LanguageEnum
>;

export function getKeyByValue(
  value: number
): keyof typeof LanguageEnum | undefined {
  return (Object.keys(LanguageEnum) as Array<keyof typeof LanguageEnum>).find(
    (key) => LanguageEnum[key] === value
  );
}
