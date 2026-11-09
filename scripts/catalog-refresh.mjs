/** Keep unrequested categories intact when refreshing part of a catalog. */
export function preserveUnrefreshedActivities(target, previous, refreshedCategories) {
  if (!Array.isArray(previous)) {
    throw new Error("Cannot perform a partial refresh without an existing activity catalog.");
  }
  if (target.size === 0) {
    throw new Error("No activities collected; leaving the bundled catalog unchanged.");
  }
  for (const activity of previous) {
    if (!refreshedCategories.has(activity.category) && !target.has(activity.catalogId)) {
      target.set(activity.catalogId, activity);
    }
  }
}
