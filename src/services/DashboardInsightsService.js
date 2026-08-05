import { query, queryOne } from "../database/connection";

const COMPLETED_STATUSES = "('completed', 'partial_return', 'returned')";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pctChange(current, previous) {
  if (!previous || previous <= 0) {
    if (current > 0) return 100;
    return 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

class DashboardInsightsService {
  async getWeeklySalesTotals() {
    const [thisWeek, lastWeek] = await Promise.all([
      queryOne(
        `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS orders
         FROM sales
         WHERE status IN ${COMPLETED_STATUSES}
           AND date(created_at) >= date('now', '-6 days')`
      ),
      queryOne(
        `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS orders
         FROM sales
         WHERE status IN ${COMPLETED_STATUSES}
           AND date(created_at) >= date('now', '-13 days')
           AND date(created_at) < date('now', '-6 days')`
      ),
    ]);
    return {
      thisWeekTotal: Number(thisWeek?.total ?? 0),
      thisWeekOrders: Number(thisWeek?.orders ?? 0),
      lastWeekTotal: Number(lastWeek?.total ?? 0),
      lastWeekOrders: Number(lastWeek?.orders ?? 0),
    };
  }

  async getBusiestDay() {
    const rows = await query(
      `SELECT CAST(strftime('%w', created_at) AS INTEGER) AS dow,
              COUNT(*) AS orders,
              COALESCE(SUM(total), 0) AS revenue
       FROM sales
       WHERE status IN ${COMPLETED_STATUSES}
         AND date(created_at) >= date('now', '-30 days')
       GROUP BY dow
       ORDER BY revenue DESC
       LIMIT 1`
    );
    if (!rows.length) return null;
    const row = rows[0];
    return {
      day: DAY_NAMES[Number(row.dow)] || "Unknown",
      orders: Number(row.orders),
      revenue: Number(row.revenue),
    };
  }

  async getTopProducts(limit = 5) {
    return query(
      `SELECT p.id, p.name, p.name_ar, p.quantity, p.min_stock,
              SUM(si.quantity) AS units_sold,
              COALESCE(SUM(si.total), 0) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.status IN ${COMPLETED_STATUSES}
         AND date(s.created_at) >= date('now', '-6 days')
       GROUP BY p.id
       ORDER BY units_sold DESC
       LIMIT $1`,
      [limit]
    );
  }

  async getProductTimePattern() {
    const rows = await query(
      `SELECT p.name,
              SUM(CASE WHEN CAST(strftime('%H', s.created_at) AS INTEGER) >= 18 THEN si.quantity ELSE 0 END) AS evening_qty,
              SUM(CASE WHEN CAST(strftime('%H', s.created_at) AS INTEGER) < 12 THEN si.quantity ELSE 0 END) AS morning_qty,
              SUM(si.quantity) AS total_qty
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.status IN ${COMPLETED_STATUSES}
         AND date(s.created_at) >= date('now', '-30 days')
       GROUP BY p.id
       HAVING total_qty >= 8
       ORDER BY total_qty DESC
       LIMIT 40`
    );

    let best = null;
    for (const row of rows) {
      const total = Number(row.total_qty) || 0;
      const evening = Number(row.evening_qty) || 0;
      const morning = Number(row.morning_qty) || 0;
      if (total < 8) continue;

      const eveningShare = evening / total;
      const morningShare = morning / total;

      if (eveningShare >= 0.55 && evening >= 5) {
        const score = eveningShare;
        if (!best || score > best.score) {
          best = {
            name: row.name,
            period: "evening",
            label: "after 6 PM",
            share: Math.round(eveningShare * 100),
            score,
          };
        }
      } else if (morningShare >= 0.55 && morning >= 5) {
        const score = morningShare;
        if (!best || score > best.score) {
          best = {
            name: row.name,
            period: "morning",
            label: "before noon",
            share: Math.round(morningShare * 100),
            score,
          };
        }
      }
    }

    return best;
  }

  async getStockRunoutForecasts() {
    const products = await query(
      `SELECT p.id, p.name, p.quantity, p.min_stock, u.symbol AS unit_symbol
       FROM products p
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE COALESCE(p.published, 1) = 1
         AND p.quantity >= 0
       ORDER BY p.quantity ASC
       LIMIT 80`
    );

    if (!products.length) return [];

    const velocityRows = await query(
      `SELECT si.product_id,
              SUM(si.quantity) AS sold_qty
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status IN ${COMPLETED_STATUSES}
         AND date(s.created_at) >= date('now', '-14 days')
       GROUP BY si.product_id`
    );

    const velocityMap = Object.fromEntries(
      velocityRows.map((row) => [row.product_id, Number(row.sold_qty) / 14])
    );

    const forecasts = [];
    for (const product of products) {
      const avgDaily = velocityMap[product.id] || 0;
      if (avgDaily <= 0) continue;

      const daysLeft = product.quantity / avgDaily;
      if (daysLeft > 5) continue;

      forecasts.push({
        id: product.id,
        name: product.name,
        quantity: Number(product.quantity),
        unitSymbol: product.unit_symbol,
        avgDaily: round1(avgDaily),
        daysLeft: round1(daysLeft),
        urgent: daysLeft <= 1.5 || product.quantity <= product.min_stock,
      });
    }

    return forecasts.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 4);
  }

  async getReturnRateInsight() {
    const row = await queryOne(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM sales
          WHERE status IN ${COMPLETED_STATUSES}
            AND date(created_at) >= date('now', '-6 days')) AS sales_total,
         (SELECT COALESCE(SUM(total_refund), 0) FROM sale_returns
          WHERE date(created_at) >= date('now', '-6 days')) AS returns_total`
    );
    const salesTotal = Number(row?.sales_total ?? 0);
    const returnsTotal = Number(row?.returns_total ?? 0);
    if (salesTotal <= 0 || returnsTotal <= 0) return null;

    const rate = Math.round((returnsTotal / salesTotal) * 100);
    if (rate < 8) return null;

    return { rate, returnsTotal, salesTotal };
  }

  buildInsights(data) {
    const insights = [];
    const {
      weekly,
      busiestDay,
      topProducts,
      timePattern,
      stockForecasts,
      returnRate,
    } = data;

    if (weekly.thisWeekOrders > 0 || weekly.lastWeekOrders > 0) {
      const change = pctChange(weekly.thisWeekTotal, weekly.lastWeekTotal);
      if (weekly.lastWeekTotal > 0) {
        if (change <= -5) {
          insights.push({
            id: "sales-down",
            type: "warning",
            title: "Sales trend",
            message: `Sales dropped ${Math.abs(change)}% this week compared to last week.`,
            detail: `${weekly.thisWeekOrders} orders · ${weekly.lastWeekOrders} last week`,
            priority: 90,
          });
        } else if (change >= 8) {
          insights.push({
            id: "sales-up",
            type: "positive",
            title: "Sales trend",
            message: `Sales are up ${change}% this week — great momentum.`,
            detail: `${weekly.thisWeekOrders} orders in the last 7 days`,
            priority: 70,
          });
        }
      } else if (weekly.thisWeekTotal > 0) {
        insights.push({
          id: "sales-start",
          type: "positive",
          title: "Getting started",
          message: "You recorded your first sales this week. Insights will get smarter as you sell more.",
          priority: 40,
        });
      }
    }

    if (busiestDay?.orders >= 3) {
      insights.push({
        id: "busiest-day",
        type: "timing",
        title: "Busiest day",
        message: `${busiestDay.day} is your busiest day over the last 30 days.`,
        detail: `${busiestDay.orders} orders · strongest weekly pattern`,
        priority: 60,
      });
    }

    if (timePattern) {
      insights.push({
        id: "product-timing",
        type: "product",
        title: "Time pattern",
        message: `${timePattern.name} sells better ${timePattern.label} (${timePattern.share}% of its sales).`,
        detail: "Based on the last 30 days of sales",
        priority: 65,
      });
    }

    if (topProducts.length > 0) {
      const top = topProducts[0];
      const units = Number(top.units_sold);
      if (units >= 2) {
        insights.push({
          id: "top-product",
          type: "product",
          title: "Top seller",
          message: `${top.name} is your #1 product this week with ${units} units sold.`,
          detail: topProducts.length > 1
            ? `#2: ${topProducts[1].name} (${Number(topProducts[1].units_sold)} units)`
            : "Keep it stocked on the POS",
          priority: 80,
        });
      }
    }

    for (const forecast of stockForecasts) {
      const dayLabel =
        forecast.daysLeft <= 1
          ? "tomorrow"
          : forecast.daysLeft <= 2
            ? "in about 2 days"
            : `in about ${Math.ceil(forecast.daysLeft)} days`;

      insights.push({
        id: `stock-${forecast.id}`,
        type: forecast.urgent ? "warning" : "inventory",
        title: forecast.urgent ? "Low stock alert" : "Stock forecast",
        message: `You may run out of ${forecast.name} ${dayLabel}.`,
        detail: `${forecast.quantity} left · ~${forecast.avgDaily}/day sales pace`,
        priority: forecast.urgent ? 100 : 75,
      });
    }

    if (returnRate) {
      insights.push({
        id: "returns-high",
        type: "warning",
        title: "Returns",
        message: `Returns are ${returnRate.rate}% of sales this week — worth a quick review.`,
        priority: 55,
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "empty",
        type: "neutral",
        title: "Smart Insights",
        message: "Complete a few sales to unlock trends, top products, and stock forecasts.",
        priority: 1,
      });
    }

    return insights.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }

  async getInsights() {
    const [weekly, busiestDay, topProducts, timePattern, stockForecasts, returnRate] =
      await Promise.all([
        this.getWeeklySalesTotals(),
        this.getBusiestDay(),
        this.getTopProducts(5),
        this.getProductTimePattern(),
        this.getStockRunoutForecasts(),
        this.getReturnRateInsight(),
      ]);

    const insights = this.buildInsights({
      weekly,
      busiestDay,
      topProducts,
      timePattern,
      stockForecasts,
      returnRate,
    });

    return {
      insights,
      topProducts: topProducts.map((row) => ({
        id: row.id,
        name: row.name,
        nameAr: row.name_ar,
        unitsSold: Number(row.units_sold),
        revenue: Number(row.revenue),
        stock: Number(row.quantity),
      })),
    };
  }
}

export const dashboardInsightsService = new DashboardInsightsService();
