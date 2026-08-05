import { query, queryOne, execute, insert } from "../database/connection";
import { ROLES } from "../utils/roles";
import {
  todayISO,
  addMonthsToDate,
  calculateExpirationDate,
  computeSubscription,
  getPlanMonths,
  SUBSCRIPTION_STATUS,
} from "../utils/subscriptions";

class SubscriptionService {
  async getRawByUserId(userId) {
    return queryOne("SELECT * FROM user_subscriptions WHERE user_id = $1", [Number(userId)]);
  }

  async getForUser(userId, referenceDate) {
    const raw = await this.getRawByUserId(userId);
    return computeSubscription(raw, referenceDate);
  }

  async getAllWithUsers({ page = 1, limit = 10, search = "", statusFilter = "all" } = {}) {
    const params = [];
    let where = "WHERE u.role != $1";
    params.push(ROLES.ADMIN);

    if (search.trim()) {
      where += ` AND (u.username LIKE $${params.length + 1} OR u.full_name LIKE $${params.length + 1})`;
      params.push(`%${search.trim()}%`);
    }

    const rows = await query(
      `SELECT u.id, u.username, u.full_name, u.role, u.is_active,
              s.id AS subscription_id, s.plan, s.start_date, s.expires_at,
              s.last_renewed_at, s.next_renewal_at, s.is_suspended, s.suspended_at
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       ${where}
       ORDER BY u.username ASC`,
      params
    );

    const today = todayISO();
    let items = rows.map((row) => {
      const subscription = row.subscription_id
        ? computeSubscription(
            {
              id: row.subscription_id,
              user_id: row.id,
              plan: row.plan,
              start_date: row.start_date,
              expires_at: row.expires_at,
              last_renewed_at: row.last_renewed_at,
              next_renewal_at: row.next_renewal_at,
              is_suspended: row.is_suspended,
              suspended_at: row.suspended_at,
            },
            today
          )
        : computeSubscription(null, today);

      return {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        role: row.role,
        is_active: row.is_active,
        subscription,
      };
    });

    if (statusFilter && statusFilter !== "all") {
      items = items.filter((item) => item.subscription.status === statusFilter);
    }

    const total = items.length;
    const offset = (page - 1) * limit;
    items = items.slice(offset, offset + limit);

    return { items, total, page, limit };
  }

  async getSummary() {
    const { items } = await this.getAllWithUsers({ page: 1, limit: 10000 });
    const summary = {
      total: items.length,
      active: 0,
      expiringSoon: 0,
      expired: 0,
      suspended: 0,
      none: 0,
    };

    for (const item of items) {
      switch (item.subscription.status) {
        case SUBSCRIPTION_STATUS.ACTIVE:
          summary.active += 1;
          break;
        case SUBSCRIPTION_STATUS.EXPIRING_SOON:
          summary.expiringSoon += 1;
          break;
        case SUBSCRIPTION_STATUS.EXPIRED:
          summary.expired += 1;
          break;
        case SUBSCRIPTION_STATUS.SUSPENDED:
          summary.suspended += 1;
          break;
        default:
          summary.none += 1;
      }
    }

    return summary;
  }

  async assign({ userId, plan, startDate }) {
    const user = await queryOne("SELECT id, role FROM users WHERE id = $1", [Number(userId)]);
    if (!user) throw new Error("User not found");
    if (user.role === ROLES.ADMIN) {
      throw new Error("Administrators do not require a subscription");
    }

    const start = startDate || todayISO();
    const expiresAt = calculateExpirationDate(start, plan);
    const existing = await this.getRawByUserId(userId);

    if (existing) {
      await execute(
        `UPDATE user_subscriptions
         SET plan = $1, start_date = $2, expires_at = $3, last_renewed_at = $2,
             next_renewal_at = $3, is_suspended = 0, suspended_at = NULL,
             updated_at = datetime('now')
         WHERE user_id = $4`,
        [plan, start, expiresAt, Number(userId)]
      );
    } else {
      await insert(
        `INSERT INTO user_subscriptions
         (user_id, plan, start_date, expires_at, last_renewed_at, next_renewal_at, is_suspended)
         VALUES ($1, $2, $3, $4, $3, $4, 0)`,
        [Number(userId), plan, start, expiresAt]
      );
    }

    return this.getForUser(userId);
  }

  async renew(userId, plan) {
    const raw = await this.getRawByUserId(userId);
    if (!raw) throw new Error("No subscription to renew — assign a plan first");

    const activePlan = plan || raw.plan;
    const months = getPlanMonths(activePlan);
    if (!months) throw new Error("Invalid subscription plan");

    const today = todayISO();
    const baseDate =
      raw.expires_at && daysBetweenSafe(today, raw.expires_at?.slice(0, 10)) >= 0
        ? raw.expires_at.slice(0, 10)
        : today;
    const expiresAt = addMonthsToDate(baseDate, months);

    await execute(
      `UPDATE user_subscriptions
       SET plan = $1, last_renewed_at = $2, expires_at = $3, next_renewal_at = $3,
           is_suspended = 0, suspended_at = NULL, updated_at = datetime('now')
       WHERE user_id = $4`,
      [activePlan, today, expiresAt, Number(userId)]
    );

    return this.getForUser(userId);
  }

  async extend(userId, extraMonths) {
    const raw = await this.getRawByUserId(userId);
    if (!raw) throw new Error("No subscription to extend");

    const months = Number(extraMonths);
    if (!months || months < 1) throw new Error("Extension must be at least 1 month");

    const today = todayISO();
    const baseDate = raw.expires_at?.slice(0, 10) || today;
    const expiresAt = addMonthsToDate(baseDate, months);

    await execute(
      `UPDATE user_subscriptions
       SET expires_at = $1, next_renewal_at = $1, last_renewed_at = $2,
           updated_at = datetime('now')
       WHERE user_id = $3`,
      [expiresAt, today, Number(userId)]
    );

    return this.getForUser(userId);
  }

  async changePlan(userId, plan, { resetStart = true, startDate } = {}) {
    const raw = await this.getRawByUserId(userId);
    if (!raw) {
      return this.assign({ userId, plan, startDate: startDate || todayISO() });
    }

    const start = resetStart ? startDate || todayISO() : raw.start_date?.slice(0, 10) || todayISO();
    const expiresAt = calculateExpirationDate(start, plan);

    await execute(
      `UPDATE user_subscriptions
       SET plan = $1, start_date = $2, expires_at = $3, next_renewal_at = $3,
           last_renewed_at = $2, updated_at = datetime('now')
       WHERE user_id = $4`,
      [plan, start, expiresAt, Number(userId)]
    );

    return this.getForUser(userId);
  }

  async suspend(userId) {
    const raw = await this.getRawByUserId(userId);
    if (!raw) throw new Error("No subscription to suspend");

    await execute(
      `UPDATE user_subscriptions
       SET is_suspended = 1, suspended_at = $1, updated_at = datetime('now')
       WHERE user_id = $2`,
      [todayISO(), Number(userId)]
    );

    return this.getForUser(userId);
  }

  async reactivate(userId) {
    const raw = await this.getRawByUserId(userId);
    if (!raw) throw new Error("No subscription to reactivate");

    await execute(
      `UPDATE user_subscriptions
       SET is_suspended = 0, suspended_at = NULL, updated_at = datetime('now')
       WHERE user_id = $1`,
      [Number(userId)]
    );

    return this.getForUser(userId);
  }
}

function daysBetweenSafe(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.round((to - from) / 86400000);
}

export const subscriptionService = new SubscriptionService();
