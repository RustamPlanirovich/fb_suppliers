// Соответствие маршрута и экрана. Новый раздел добавляется здесь и в ROUTES.
import { DashboardView } from '../views/dashboard.view.js';
import { SuppliersView } from '../views/suppliers.view.js';
import { CatalogView } from '../views/catalog.view.js';
import { OffersView } from '../views/offers.view.js';
import { ArbitrageView } from '../views/arbitrage.view.js';
import { FlagsView } from '../views/flags.view.js';
import { ModerationView } from '../views/moderation.view.js';
import { UsersView } from '../views/users.view.js';
import { PlansView } from '../views/plans.view.js';
import { PromotionsView } from '../views/promotions.view.js';
import { ContentView } from '../views/content.view.js';
import { BroadcastsView } from '../views/broadcasts.view.js';
import { MarketView } from '../views/market.view.js';
import { SourcesView } from '../views/sources.view.js';
import { IoView } from '../views/io.view.js';

export const VIEWS = {
  dashboard: DashboardView,
  suppliers: SuppliersView,
  catalog: CatalogView,
  offers: OffersView,
  arbitrage: ArbitrageView,
  flags: FlagsView,
  moderation: ModerationView,
  users: UsersView,
  plans: PlansView,
  promotions: PromotionsView,
  content: ContentView,
  broadcasts: BroadcastsView,
  market: MarketView,
  sources: SourcesView,
  io: IoView,
};
