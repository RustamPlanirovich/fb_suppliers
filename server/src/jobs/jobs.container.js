// Сами задачи: тонкие обёртки над сервисами компонентов.
import { flagsScanner } from '../components/flags/flags.router.js';
import { arbitrageService } from '../components/arbitrage/arbitrage.router.js';
import { alertsEngine } from '../components/bot/bot.container.js';
import { broadcastsService } from '../components/broadcasts/broadcasts.router.js';
import { subscriptionsRepository } from '../components/subscriptions/subscriptions.container.js';
import { variantsStatsRepository } from '../components/catalog/catalog.container.js';
import { funpaySyncService, sourceNodesRepository } from '../components/funpay/funpay.container.js';
import { config } from '../utils/config.js';

const STALE_VARIANTS_PER_RUN = 200;
const SOURCE_NODES_PER_RUN = 5;
const SOURCE_STALE_HOURS = 6;

export const jobs = {
  async variantStats() {
    const ids = await variantsStatsRepository.staleIds(STALE_VARIANTS_PER_RUN);
    const refreshed = await variantsStatsRepository.refreshMany(ids);
    return { refreshed: refreshed.length };
  },
  arbitrage: () => arbitrageService.recompute(),
  alerts: () => alertsEngine.run(),
  flags: () => flagsScanner.run(),
  async subscriptions() {
    return { expired: await subscriptionsRepository.expireOutdated() };
  },
  broadcasts: () => broadcastsService.runDue(),
  // Регулярное обновление цен по сохранённым разделам площадки.
  async sourceSync() {
    if (!config.funpay.enabled) return { skipped: 'sync disabled' };
    const nodes = await sourceNodesRepository.due(SOURCE_NODES_PER_RUN, SOURCE_STALE_HOURS);
    const results = [];
    for (const node of nodes) {
      const result = await funpaySyncService.syncNode({
        nodeId: node.node_id,
        url: node.url,
        productName: node.node_name ? `${node.game_name} ${node.node_name}` : node.game_name,
        categoryId: node.category_id ?? undefined,
        gameName: node.game_name,
        nodeName: node.node_name,
        variantAttrs: node.variant_attrs ?? [],
        titleRules: node.title_rules ?? [],
        withSellers: node.with_sellers,
      }, null).catch((err) => ({ nodeId: node.node_id, error: err.message }));
      await sourceNodesRepository.saveResult(node.id, { ...result, groups: undefined });
      results.push(result);
    }
    return { synced: results.length };
  },
};
