export const GET_PRIMARY_LOCATION = `
query {
  locations(first: 1) {
    edges { node { id name } }
  }
}`;

export const GET_ORDER_BY_ID = `
query getOrder($id: ID!) {
  order(id: $id) {
    id
    name
    displayFinancialStatus
    totalPriceSet { shopMoney { amount } }
    lineItems(first: 20) {
      edges { node { title quantity variant { id product { id } } } }
    }
  }
}`;
