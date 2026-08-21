import { funpayProvider } from './funpay.provider.js';
import { digisellerProvider } from './digiseller.provider.js';
import { playerokProvider } from './playerok.provider.js';

// Реестр источников. Новая площадка добавляется сюда и строкой в справочнике marketplaces.
export const PROVIDERS = {
  [funpayProvider.code]: funpayProvider,
  [digisellerProvider.code]: digisellerProvider,
  [playerokProvider.code]: playerokProvider,
};

export const PROVIDER_CODES = Object.keys(PROVIDERS);

export const providerList = () => Object.values(PROVIDERS).map((provider) => ({
  code: provider.code, title: provider.title, catalogHint: provider.catalogHint,
}));
