// Bu projenin platform anahtari — organization_members.platform kolonunda
// kullanilir. Karardestek 'karar-destek', biz 'solar-teklif'.
// Davet/rol/uyelik tum sorgulari bu deger ile filtrelenir; baska bir platforma
// davet edilen kullanici bu sitede gozukmez.
export const PLATFORM_KEY = "solar-teklif" as const;
export type PlatformKey = typeof PLATFORM_KEY;
