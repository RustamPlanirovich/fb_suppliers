import { SuppliersRepository } from '../suppliers/suppliers.repository.js';
import {
  catalogService, marketRepository, offersRepository, offersHistoryRepository,
  variantsStatsRepository,
} from '../catalog/catalog.container.js';
import { SourceNodesRepository } from '../funpay/source.nodes.repository.js';
import { PROVIDERS } from './providers/index.js';
import { SourceSyncService } from './source.sync.service.js';
import { ShopsService } from './shops.service.js';

export const sourceNodesRepository = new SourceNodesRepository();

export const sourceSyncService = new SourceSyncService({
  providers: PROVIDERS,
  market: marketRepository,
  catalog: catalogService,
  stats: variantsStatsRepository,
  suppliersRepo: new SuppliersRepository(),
  offersRepo: offersRepository,
  historyRepo: offersHistoryRepository,
});

export const shopsService = new ShopsService({
  sync: sourceSyncService,
  nodes: sourceNodesRepository,
  market: marketRepository,
});
