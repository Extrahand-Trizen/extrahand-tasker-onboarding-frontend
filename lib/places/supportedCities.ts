export const SUPPORTED_CITIES = [
  'Warangal',
  'Karimnagar',
  'Nalgonda',
  'Mahabubnagar',
  'Siddipet',
  'Nizamabad',
  'Kalwakurthy',
  'Wanaparthy',
] as const;

export function getSupportedCityName(value: string): (typeof SUPPORTED_CITIES)[number] | undefined {
  const normalizedValue = value.trim().toLocaleLowerCase();
  return SUPPORTED_CITIES.find((city) => city.toLocaleLowerCase() === normalizedValue);
}
