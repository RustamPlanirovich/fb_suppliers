// Сборка зависимостей бота. Здесь — только проводка, без логики.
import { UsersRepository } from '../users/users.repository.js';
import { FavoritesRepository } from '../users/favorites.repository.js';
import { PositionsRepository } from '../users/positions.repository.js';
import { AlertsRepository } from '../alerts/alerts.repository.js';
import { AlertsEngine } from '../alerts/alerts.engine.js';
import { SearchRepository } from '../search/search.repository.js';
import { SearchService } from '../search/search.service.js';
import { ModerationRepository } from '../moderation/moderation.repository.js';
import { SuppliersRepository } from '../suppliers/suppliers.repository.js';
import { SuppliersStatsRepository } from '../suppliers/suppliers.stats.repository.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { ContentRepository } from '../content/content.repository.js';
import { ContentService } from '../content/content.service.js';
import { accessService, plansRepository } from '../subscriptions/subscriptions.container.js';
import { arbitrageService } from '../arbitrage/arbitrage.router.js';
import { OpportunitiesRepository } from '../analytics/opportunities.repository.js';
import { MarketAccessService } from '../analytics/market.access.service.js';
import {
  catalogService, offersService, offersRepository, variantsRepository, marketRepository,
} from '../catalog/catalog.container.js';
import { telegramSender } from './telegram.sender.js';
import { BotSession } from './bot.session.js';

export const usersRepo = new UsersRepository();
export const favoritesRepo = new FavoritesRepository();
export const positionsRepo = new PositionsRepository();
export const alertsRepo = new AlertsRepository();
export const moderationRepo = new ModerationRepository();
export const contentService = new ContentService(new ContentRepository());

export const searchService = new SearchService(
  new SearchRepository(), variantsRepository, offersRepository, marketRepository,
);

export const suppliersService = new SuppliersService(
  new SuppliersRepository(), new SuppliersStatsRepository(),
);

export const alertsEngine = new AlertsEngine(alertsRepo, telegramSender);
export const marketAccessService = new MarketAccessService(new OpportunitiesRepository());
export const botSession = new BotSession(usersRepo, accessService);

export const botDeps = {
  users: usersRepo,
  favorites: favoritesRepo,
  positions: positionsRepo,
  alerts: alertsRepo,
  moderation: moderationRepo,
  suppliers: suppliersService,
  catalog: catalogService,
  offers: offersService,
  arbitrage: arbitrageService,
  analytics: marketAccessService,
  plans: plansRepository,
  access: accessService,
  search: searchService,
  content: contentService,
  session: botSession,
};
