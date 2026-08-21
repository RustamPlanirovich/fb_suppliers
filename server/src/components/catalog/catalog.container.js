// Сборка зависимостей каталога в одном месте: репозитории → сервисы.
import { flagsRepository } from '../flags/flags.router.js';
import { ProductsRepository } from './products.repository.js';
import { VariantsRepository } from './variants.repository.js';
import { VariantsStatsRepository } from './variants.stats.repository.js';
import { OffersRepository } from './offers.repository.js';
import { OffersHistoryRepository } from './offers.history.repository.js';
import { MarketRepository } from './market.repository.js';
import { CatalogService } from './catalog.service.js';
import { OffersService } from './offers.service.js';

export const productsRepository = new ProductsRepository();
export const variantsRepository = new VariantsRepository();
export const variantsStatsRepository = new VariantsStatsRepository();
export const offersRepository = new OffersRepository();
export const offersHistoryRepository = new OffersHistoryRepository();
export const marketRepository = new MarketRepository();

export const catalogService = new CatalogService(
  productsRepository, variantsRepository, variantsStatsRepository,
);

export const offersService = new OffersService(
  offersRepository, offersHistoryRepository, variantsStatsRepository, flagsRepository,
);
