export const PRODUCT_CREATE = `
mutation productCreate($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      title
      status
      variants(first: 1) { edges { node { id inventoryItem { id } } } }
    }
    userErrors { field message }
  }
}`;

export const INVENTORY_SET_QUANTITIES = `
mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    inventoryAdjustmentGroup { createdAt reason }
    userErrors { field message }
  }
}`;

export const WEBHOOK_SUBSCRIPTION_CREATE = `
mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription { id }
    userErrors { field message }
  }
}`;
